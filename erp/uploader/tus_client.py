from tusclient import client
import os

TUS_SERVER = "http://localhost:1080/files/"

def upload_to_tus(file_path):
    tus_client = client.TusClient(TUS_SERVER)

    uploader = tus_client.uploader(
        file_path=file_path,
        chunk_size=5 * 1024 * 1024,
        metadata={
            "filename": os.path.basename(file_path),
            "filetype": "application/octet-stream"
        }
    )

    uploader.upload()

    return uploader.url