from django.urls import path, include
from uploader.views import upload_file, upload_page, list_files, save_file, delete_file, delete_dir, file_tree, tree_view
from uploader.views import dashboard, create_directory, get_directory, get_files, rename_folder, rename_file, login, login_page, storage_page, storage

urlpatterns = [
    path("upload/", upload_file),
    path("files/", list_files),
    path("save-file/", save_file),
    path("delete-file/<int:id>/", delete_file),
    path("delete-dir/<int:id>/", delete_dir),
    path("file-tree/", file_tree),
    path("create-directory/", create_directory),
    path("get-directory/", get_directory),
    path("get-files/", get_files),
    path("get-files/<int:parent_id>/", get_files),
    path("rename-folder/<int:id>/", rename_folder),
    path("rename-file/<int:id>/", rename_file),
    path("ui/", upload_page),
    path("ui/tree_view", tree_view),
    path("btv/", dashboard),
    path("login/", login_page),
    path("api/login/", login),
    path("storage-page/", storage_page),
    path("api/storage/", storage),
]