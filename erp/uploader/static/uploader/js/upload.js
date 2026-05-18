let selectedFiles = [];
let uploads = {};
let uploadedFiles = new Set();
let uploadStartTimes = {};
let folderFilesMap = {};

// ================= MODAL =================
function openUploadModal() {
    parent_id = currentNode?.id || null;  // ✅ capture current folder
    document.getElementById("uploadModal").style.display = "block";
}

function closeUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
}

// ================= FILE ADD =================
function addFiles() {
    const input = document.getElementById("fileInput");
    input.click();
}

function addFilesOld() {

    const input = document.getElementById("fileInput");
    const files = Array.from(input.files);

    files.forEach(file => {

        if (file.size > 2 * 1024 * 1024 * 1024) {
            alert(file.name + " exceeds 2GB!");
            return;
        }

        if (selectedFiles.find(f => f.name === file.name)) {
            alert(file.name + " already added");
            return;
        }

        selectedFiles.push(file);
    });

    renderFileList();
    input.value = "";
}

// ================= REMOVE =================
function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

// ================= RENDER =================
function renderFileList() {

    const container = document.getElementById("fileList");
    container.innerHTML = "";

    if (selectedFiles.length === 0) {
        container.innerHTML = "<p style='color:#999'>No files selected</p>";
        return;
    }

    selectedFiles.forEach((file, index) => {

        const div = document.createElement("div");
        div.className = "file-item";

        div.innerHTML = `
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatSize(file.size)}</div>

            <button class="remove-btn" onclick="removeFile(${index})">✖</button>

            <div class="progress-bar">
                <div class="progress-fill" id="progress-${index}"></div>
            </div>

            <div class="status" id="status-${index}">Waiting...</div>
        `;

        container.appendChild(div);
    });
}

// ================= START UPLOAD =================
function startUpload() {

    if (selectedFiles.length === 0) {
        alert("No files selected");
        return;
    }

    let parentId = currentNode?.id || null;

    selectedFiles.forEach((file, index) => {
        uploadSingleFile(file, index, parentId);
    });
}

// ================= UPLOAD SINGLE =================
function uploadSingleFile(file, index, parentId) {

    if (uploadedFiles.has(file.name)) {
        updateStatus(index, "Already uploaded ❌");
        return;
    }

    let startTime = Date.now();
    uploadStartTimes[file.name] = startTime;

    const upload = new tus.Upload(file, {
        endpoint: "http://172.20.10.165/files/",
        retryDelays: [0, 3000, 5000, 10000],

        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        },

        metadata: {
            filename: file.name,
            filetype: file.type,
            parent_id: parentId
        },

        onProgress: function (bytesUploaded, bytesTotal) {

            let percent = Math.floor((bytesUploaded / bytesTotal) * 100);

            document.getElementById("progress-" + index).style.width = percent + "%";

            // remaining time
            let elapsed = (Date.now() - startTime) / 1000;
            let speed = bytesUploaded / elapsed;
            let remaining = (bytesTotal - bytesUploaded) / speed;

            updateStatus(index, percent + "% | " + formatTime(remaining));
        },

        onError: function (error) {
            updateStatus(index, "Failed ❌");
            console.error(error);
        },

        onSuccess: async function () {

            updateStatus(index, "Completed ✔");

            const res = await saveToDjango(file.name, upload.url, parentId);

            uploadedFiles.add(file.name);

            // 🔥 CRITICAL: inject into UI tree immediately
            injectFileIntoTree(file, upload.url, parentId);

            console.log(upload)
        }

        // onSuccess: async function () {
        //     updateStatus(index, "Completed ✔");
        //     const saved = await saveToDjango(file.name, upload.url,  parent_id);
        //     uploadedFiles.add(file.name);
        //     // 🔥 INSTANT UI UPDATE (NO REFRESH)
        //     let fileObj = {
        //         filename: file.name,
        //         tus_url: upload.url,
        //         id: saved.id || Date.now()
        //     };
        //     let folderId = currentNode?.id || null;
        //
        //     if (!folderFilesMap[folderId]) {
        //         folderFilesMap[folderId] = [];
        //     }
        //     folderFilesMap[folderId].push(fileObj);
        //     renderFiles(folderFilesMap[folderId]);
        // }
    });

    uploads[file.name] = upload;
    upload.start();
}

// ================= STATUS =================
function updateStatus(index, text) {
    document.getElementById("status-" + index).innerText = text;
}


function formatSize(bytes) {
    let sizes = ['B','KB','MB','GB'];
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

function formatTime(sec) {
    sec = Math.round(sec);
    if (sec < 60) return sec + " sec left";
    return Math.floor(sec/60) + " min left";
}

// ================= DJANGO SAVE =================
async function saveToDjango(filename, tus_url, parent_id) {

    const res = await fetch("http://127.0.0.1:8000/save-file/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filename: filename,
            tus_url: tus_url,
            file_dir: document.getElementById("fileDir")?.value || "",
            parent_id : parent_id  // ✅ FIXED HERE
        })
    });

    return await res.json();
}

function handleFileSelect(event) {

    const files = Array.from(event.target.files);

    files.forEach(file => {

        if (file.size > 2 * 1024 * 1024 * 1024) {
            alert(file.name + " exceeds 2GB");
            return;
        }

        if (!selectedFiles.find(f => f.name === file.name)) {
            selectedFiles.push(file);
        }
    });

    renderFileList();

    // IMPORTANT FIX
    event.target.value = "";
}

// function renderFiles(files) {
//
//     const container = document.getElementById("fileArea"); // your right panel
//
//     container.innerHTML = "";
//
//     files.forEach(file => {
//
//         const div = document.createElement("div");
//         div.className = "file-card";
//
//         div.innerHTML = `
//             <div>${file.filename}</div>
//         `;
//
//         container.appendChild(div);
//     });
// }

function injectFileIntoTree(file, url, parentId) {

    const newFile = {
        id: Date.now(),

        // 🔥 STRICT UNIFIED SCHEMA (IMPORTANT)
        type: "file",

        name: file.name,
        filename: file.name,
        dir_name: null,

        tus_url: url,
        parent_id: parentId,

        children: null
    };

    // 1. current view update
    if (!currentNode.children) {
        currentNode.children = {};
    }

    currentNode.children[newFile.id] = newFile;

    // 2. TREE update (recursive safe insert)
    function insert(nodes) {

        for (let n of Object.values(nodes)) {

            if (n.id === parentId) {

                if (!n.children) n.children = {};

                n.children[newFile.id] = newFile;
                return true;
            }

            if (n.children && insert(n.children)) return true;
        }

        return false;
    }

    insert(TREE);

    // 3. re-render
    renderSidebar();
    renderMain();
}


let modal = document.querySelector(".modal-box");
let header = document.querySelector(".modal-header");

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

header.style.cursor = "move";

header.addEventListener("mousedown", function (e) {
    isDragging = true;
    offsetX = e.clientX - modal.offsetLeft;
    offsetY = e.clientY - modal.offsetTop;
});

document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;

    modal.style.position = "absolute";
    modal.style.left = (e.clientX - offsetX) + "px";
    modal.style.top = (e.clientY - offsetY) + "px";
});

document.addEventListener("mouseup", function () {
    isDragging = false;
});


const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

// Prevent default browser behavior (important)
["dragenter", "dragover", "dragleave", "drop"].forEach(event => {
    dropZone.addEventListener(event, e => {
        e.preventDefault();
        e.stopPropagation();
    });
});

// Highlight on drag enter
dropZone.addEventListener("dragenter", () => {
    dropZone.classList.add("dragover");
});

// Highlight on drag over
dropZone.addEventListener("dragover", () => {
    dropZone.classList.add("dragover");
});

// Remove highlight
dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

// Handle file drop
dropZone.addEventListener("drop", (e) => {
    dropZone.classList.remove("dragover");

    const files = e.dataTransfer.files;

    // Send to your existing handler
    handleDroppedFiles(files);
});

// reuse your existing logic
function handleDroppedFiles(files) {
    let event = { target: { files } };
    handleFileSelect(event);
}


function injectFileIntoTreebb(file, url, parentId) {

    const newFile = {
        id: Date.now(),

        // 🔥 UNIFIED MODEL (CRITICAL FIX)
        name: file.name,
        dir_name: null,        // folder only
        filename: file.name,   // optional fallback

        tus_url: url,
        parent_id: parentId,
        type: "file",
        children: {}
    };

    if (!currentNode.children) {
        currentNode.children = {};
    }

    currentNode.children[newFile.id] = newFile;

    console.log("TREE SNAPSHOT:", TREE);
    console.log("CURRENT NODE:", currentNode);

    function insert(nodes) {

        for (let n of Object.values(nodes)) {

            if (n.id === parentId) {

                if (!n.children) n.children = {};

                n.children[newFile.id] = newFile;
                return true;
            }
            if (n.children && insert(n.children)) return true;
        }
        return false;
    }

    insert(TREE);
    renderSidebar();
    renderMain();
}

function injectFileIntoTreeBack(file, url, parentId) {

    const newFile = {
        id: Date.now(),
        filename: file.name,
        tus_url: url,
        parent_id: parentId,
        type: "file",
        children: {}
    };

    // 1. update current node view
    if (!currentNode.children) {
        currentNode.children = {};
    }

    currentNode.children[newFile.id] = newFile;

    // 2. update TREE safely
    function insert(nodes) {

        for (let n of Object.values(nodes)) {

            if (n.id === parentId) {

                if (!n.children) n.children = {}; // 🔥 FIX

                n.children[newFile.id] = newFile;
                return true;
            }

            if (n.children && insert(n.children)) return true;
        }

        return false;
    }

    insert(TREE);

    // 3. re-render UI
    renderSidebar();
    renderMain();
}