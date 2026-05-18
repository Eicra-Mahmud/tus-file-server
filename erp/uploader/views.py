import os
from django.http import JsonResponse
from django.shortcuts import render
from .models import UploadedFile, TusServerDirectory
from .tus_client import upload_to_tus
from django.views.decorators.csrf import csrf_exempt
import json
from django.db import connection
import requests
from .models import create_token
import shutil


# TUS_SERVER = "http://103.204.82.239:1080/files"
UPLOAD_DIR = "uploads_temp"
TUS_DIR    = "/data/tus/uploads/"
TUS_SERVER = "http://172.20.10.165/files"


def upload_page(request):
    return render(request, "uploader/tus-upload-ui.html")

def tree_view(request):
    return render(request, "uploader/tree_view.html")

def dashboard(request):
    return render(request, "uploader/index.html")

def login_page(request):
    return render(request, "uploader/login.html")

def storage_page(request):
    return render(request, "uploader/storage.html")


def storage(request):
    total, used, free = shutil.disk_usage(TUS_DIR)

    return JsonResponse({
        "tus_server": TUS_SERVER,
        "tus_dir": TUS_DIR,
        "total_bytes": total,
        "used_bytes": used,
        "available_bytes": free
    })


@csrf_exempt
def upload_file(request):

    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    file = request.FILES.get("file")

    if not file:
        return JsonResponse({"error": "No file uploaded"}, status=400)

    # create temp folder
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    temp_path = os.path.join(UPLOAD_DIR, file.name)

    file = request.FILES.get("file")

    file_dir = request.POST.get("fileDir", "")  # 👈 ADD THIS ONLY

    # save file locally first
    with open(temp_path, "wb+") as f:
        for chunk in file.chunks():
            f.write(chunk)

    # upload to tus server
    tus_url = upload_to_tus(temp_path)

    UploadedFile.objects.create(
        filename=file.name,
        tus_url=tus_url,
        file_dir = file_dir,

    )

    os.remove(temp_path)

    return JsonResponse({
        "message": "Upload successful",
        "tus_url": tus_url,
        "file_dir": file_dir
    })

def list_files(request):
    files = UploadedFile.objects.order_by("-created_at")

    data = [
        {
            "id" : f.id,
            "filename": f.filename,
            "tus_url": f.tus_url,
            "created_at": f.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for f in files
    ]

    return JsonResponse(data, safe=False)

@csrf_exempt
def delete_file(request, id):

    if request.method != "DELETE":
        return JsonResponse({"error": "invalid method"}, status=405)

    try:
        file = UploadedFile.objects.get(id=id)

        # 🔥 read reason (optional but recommended from frontend)
        data = json.loads(request.body or "{}")
        reason = data.get("reason", "")

        if not reason:
            return JsonResponse({
                "error": "delete reason required"
            }, status=400)

        upload_id = file.upload_id

        # =========================
        # 1. DELETE FROM TUS SERVER
        # =========================
        headers = {
            "Tus-Resumable": "1.0.0"
        }

        resp = requests.delete(
            f"{TUS_SERVER}/{upload_id}",
            headers=headers,
            timeout=10
        )

        print("TUS STATUS:", resp.status_code)
        print("TUS RESPONSE:", resp.text)

        # =========================
        # 2. IF TUS FAILS → STOP HERE
        # =========================
        if resp.status_code not in [200, 204]:

            return JsonResponse({
                "error": "tus delete failed",
                "status": resp.status_code,
                "response": resp.text
            }, status=500)

        # =========================
        # 3. UPDATE DB (SOFT LOG FIRST OPTIONAL)
        # =========================
        file.is_deleted = True
        file.delete_reason = reason  # if field exists
        file.save()

        # =========================
        # 4. DELETE FROM DB
        # =========================
        # file.delete()

        return JsonResponse({
            "status": "ok",
            "deleted": upload_id,
            "reason": reason
        })

    except UploadedFile.DoesNotExist:
        return JsonResponse({"error": "not found"}, status=404)

    except requests.RequestException as e:
        return JsonResponse({
            "error": "tus server unreachable",
            "detail": str(e)
        }, status=500)

    except Exception as e:
        return JsonResponse({
            "error": "internal error",
            "detail": str(e)
        }, status=500)

@csrf_exempt
def delete_fileBack(request, id):
    if request.method != "DELETE":
        return JsonResponse({"error": "invalid method"}, status=405)

    try:
        file = UploadedFile.objects.get(id=id)

        upload_id = file.upload_id

        headers = {
            "Tus-Resumable": "1.0.0"
        }

        resp = requests.delete(
            f"{TUS_SERVER}/{upload_id}",
            headers=headers
        )

        print("TUS STATUS:", resp.status_code)
        print("TUS RESPONSE:", resp.text)

        if resp.status_code not in [200, 204]:
            return JsonResponse({
                "error": "tus delete failed",
                "status": resp.status_code,
                "response": resp.text
            }, status=500)

        file.delete()

        return JsonResponse({
            "status": "ok",
            "deleted": upload_id
        })

    except UploadedFile.DoesNotExist:
        return JsonResponse({"error": "not found"}, status=404)

@csrf_exempt
def delete_dir(request, id):

    if request.method != "DELETE":
        return JsonResponse({"error": "POST required"}, status=400)

    has_child_folder = TusServerDirectory.objects.filter(parent_id=id).exists()
    has_child_files = UploadedFile.objects.filter(parent_id=id, is_deleted=False).exists()

    if has_child_folder or has_child_files:
        return JsonResponse({
            "error": "Folder is not empty. It contains files or folders."
        }, status=400)

    try:
        data = json.loads(request.body or "{}")

        reason = data.get("reason")

        # 🔥 VALIDATION (IMPORTANT)
        if not reason or not reason.strip():
            return JsonResponse({
                "error": "Delete reason is required"
            }, status=400)

        folder = TusServerDirectory.objects.get(id=id)

        # check children
        has_children = TusServerDirectory.objects.filter(parent_id=id).exists()

        if has_children:
            return JsonResponse({
                "error": "Folder is not empty"
            }, status=400)

        # save reason + soft delete (recommended)
        folder.delete_reason = reason
        folder.is_deleted = True
        folder.save()

        return JsonResponse({
            "success": True,
            "message": "Folder deleted"
        })

    except TusServerDirectory.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def delete_fileOld(request, id):
    if request.method == "DELETE":
        try:
            file = UploadedFile.objects.get(id=id)

            # 🔥 DELETE FROM TUS STORAGE (FILE SYSTEM)
            file_key = file.tus_url.split("/")[-1]
            file_path = os.path.join(TUS_DIR, file_key)
            info_path = file_path + ".info"

            # delete tus metadata file
            if os.path.exists(info_path):
                os.remove(info_path)

            if os.path.exists(file_path):
                os.remove(file_path)

            # 🔥 DELETE FROM SQLITE
            file.delete()

            return JsonResponse({"status": "ok"})

        except UploadedFile.DoesNotExist:
            return JsonResponse({"error": "not found"}, status=404)

@csrf_exempt
def save_file(request):
    data = json.loads(request.body)

    print(data)  # ✔ fixed print
    UploadedFile.objects.create(
        filename=data["filename"],
        tus_url=data["tus_url"],
        file_dir =data["file_dir"],
        file_extension=data["filename"].split(".")[-1],
        upload_id=data["tus_url"].split("/")[-1],  # 🔥 ADD THIS
        parent_id=data["parent_id"]
    )

    return JsonResponse({"status": "ok"})

@csrf_exempt
def create_directory(request):

    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "POST required"}, status=405)

    data = json.loads(request.body)

    print(data)

    dir_name = data.get("dir_name")
    parent_id = data.get("parent_id")
    created_by = data.get("created_by")

    if not dir_name:
        return JsonResponse({"status": "error", "message": "dir_name required"}, status=400)

    folder = TusServerDirectory.objects.create(
        dir_name=dir_name,
        parent_id=parent_id,
        created_by=created_by
    )

    return JsonResponse({
        "status": "ok",
        "id": folder.id,
        "dir_name": folder.dir_name
    })

def get_directory(request):

    # =========================
    # 1. GET DIRECTORY TREE
    # =========================
    query = """
    WITH RECURSIVE tree AS (
      SELECT
        id,
        dir_name,
        parent_id,
        CAST(dir_name AS TEXT) AS path,
        0 AS level
      FROM tus_server_directory
      WHERE parent_id IS NULL

      UNION ALL

      SELECT
        t.id,
        t.dir_name,
        t.parent_id,
        tree.path || '/' || t.dir_name AS path,
        tree.level + 1
      FROM tus_server_directory t
      INNER JOIN tree ON t.parent_id = tree.id
    )
    SELECT
        id,
        dir_name,
        parent_id,
        path,
        level
    FROM tree
    ORDER BY path;
    """

    with connection.cursor() as cursor:
        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]

    directories = [
        dict(zip(columns, row)) for row in rows
    ]

    # mark as folder
    for d in directories:
        d["type"] = "folder"
        d["tus_url"] = None
        d["tus_id"] = None



    # =========================
    # 2. GET ROOT FILES
    # =========================
    files = UploadedFile.objects.filter(parent_id__isnull=True)

    file_list = []

    for item in files:
        file_list.append({
            "id": item.id,
            "dir_name": item.filename,
            "parent_id": item.parent_id,
            "file_dir": item.file_dir,
            "tus_url": item.tus_url,
            "tus_id": item.tus_url.split("/")[-1] if item.tus_url else None,
            "type": "file",
            "path": item.filename
        })


    # =========================
    # 3. MERGE BOTH
    # =========================
    data = directories + file_list


    return JsonResponse(data, safe=False)

@csrf_exempt
def rename_folder(request, id):
    if request.method == "POST":
        data = json.loads(request.body)

        new_name = data.get("name")

        folder = TusServerDirectory.objects.get(id=id)
        folder.dir_name = new_name
        folder.save()

        return JsonResponse({"status": "success"})

@csrf_exempt
def rename_file(request, id):
    if request.method == "POST":
        data = json.loads(request.body)

        new_name = data.get("name")

        file = UploadedFile.objects.get(id=id)
        file.filename = new_name
        file.save()

        return JsonResponse({"status": "success"})

def file_tree(request):

    rows = UploadedFile.objects.all().values(
        "filename",
        "file_dir",
        "upload_id"
    )

    tree = {}

    for row in rows:

        filename = row["filename"]
        file_dir = row["file_dir"] or ""

        parts = file_dir.strip("/").split("/") if file_dir else []

        insert_into_tree(tree, parts, row)

    return JsonResponse(tree, safe=False)

def get_files(request, parent_id=None):

    # ROOT CASE (no id OR 0)
    if parent_id is None or parent_id == 0:
        data = UploadedFile.objects.filter(parent_id__isnull=True)
    else:
        data = UploadedFile.objects.filter(parent_id=parent_id)

    result = []

    for item in data:
        result.append({
            "id": item.id,
            "name": item.filename,
            "parent_id": item.parent_id,
            "dir_name": item.filename,
            "file_dir": item.file_dir,
            "tus_url": item.tus_url,
            "tus_id": item.tus_url.split("/")[-1] if item.tus_url else None,
            "type": "file"
        })

    return JsonResponse(result, safe=False)

def insert_into_tree(tree, parts, file_obj):
    node = tree

    for part in parts:
        if part not in node:
            node[part] = {}
        node = node[part]

    if "files" not in node:
        node["files"] = []

    node["files"].append({
        "name": file_obj["filename"],
        "id": file_obj["upload_id"]
    })


# fake user check (replace with DB later)
def check_user(username, password):
    if username == "admin" and password == "1234":
        return {"id": 1}
    return None


@csrf_exempt
def login(request):
    if request.method == "POST":
        data = json.loads(request.body)
        user = check_user(data["username"], data["password"])
        if not user:
            return JsonResponse({"error": "Invalid login"}, status=401)

        token = create_token(user["id"])

        return JsonResponse({
            "token": token
        })