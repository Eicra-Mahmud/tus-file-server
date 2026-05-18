# 🧾 ERP + TUS Server Setup Guide

This project contains:
- Django ERP backend
- TUS file upload server
- Local development setup

---

# 📦 Requirements

- Python 3.10+
- pip (latest recommended)
- PowerShell (Windows)
- Git (optional)

---

# ⚙️ 1. Activate Virtual Environment (Windows PowerShell)

```powershell
.env\Scripts\Activate.ps1
```

If permission error occurs:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then run again:

```powershell
.env\Scripts\Activate.ps1
```

---

# 📁 2. Go to ERP Project Folder

```bash
cd .\erp\
```

---

# 🚀 3. Run Django ERP Server

### Default run:

```bash
python manage.py runserver
```

### Run on specific port:

```bash
python manage.py runserver 8000
```

### Run on custom IP + port:

```bash
python manage.py runserver 0.0.0.0:8000
```

---

# 📂 4. TUS File Upload Server Setup

This project uses **tusd (resumable upload server)**.

---

## 🚀 Run TUS Server

### Basic run:

```bash
tusd -upload-dir ./uploads -port 1080
```

---

### Production-style setup:

```bash
tusd -upload-dir ./uploads -port 1080 -base-path /files -behind-proxy -max-size 10737418240
```

---

## 🌐 TUS Server URL

http://127.0.0.1:1080/files

---

# 🔄 Run Both Servers Together

### Terminal 1 (Django ERP)
cd erp
python manage.py runserver 8001

### Terminal 2 (TUS Server)
tusd -upload-dir ./uploads -port 1080

---

# 🌍 Access URLs

- ERP Frontend/Backend: http://127.0.0.1:8000
- TUS Server: http://127.0.0.1:1080/files
- 

---

# ⚠️ Common Issues

## Port already in use
python manage.py runserver 8002

## PowerShell execution error
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

---

# 👨‍💻 Notes

- Always activate venv before running
- Use separate ports for services

