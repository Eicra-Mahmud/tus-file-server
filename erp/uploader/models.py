from django.db import models
import jwt
import datetime

class UploadedFile(models.Model):
    filename = models.CharField(max_length=255)
    tus_url = models.URLField()
    upload_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    file_dir = models.CharField(max_length=255, null=True, blank=True)
    file_extension = models.CharField(max_length=10, null=True, blank=True)
    parent_id = models.IntegerField(null=False, blank=True)
    delete_reason = models.TextField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.filename


class TusServerDirectory(models.Model):
    dir_name = models.CharField(max_length=255)
    parent_id = models.IntegerField(null=True, blank=True)
    created_by = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    delete_reason = models.TextField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "tus_server_directory"

SECRET_KEY = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


def create_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=6)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"]
    except:
        return None