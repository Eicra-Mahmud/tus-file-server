let TREE = {};
let currentNode = { children: {} };
let stack = [];
let openNodes = {};
let clickTimer = null;
let selectedItem = null;
let deleteTarget = null;
let pathSoFar = [];

async function loadTree() {

    const res = await fetch("http://127.0.0.1:8000/get-directory");
    const data = await res.json();

    TREE = buildTree(data);

    currentNode = { children: TREE };
    stack = [];

    renderSidebar();
    renderMain();
}

function buildTree(list) {

    let map = {};
    let tree = {};

    // create nodes
    list.forEach(item => {
        map[item.id] = {
            id: item.id,
            dir_name: item.dir_name,
            parent_id: item.parent_id,
             tus_url: item.tus_url,
            type:item.type,
            filename: item.dir_name,
            children: {}
        };
    });

    // build hierarchy
    list.forEach(item => {

        let node = map[item.id];

        if (item.parent_id === null) {
            tree[item.id] = node;
        } else {
            let parent = map[item.parent_id];

            if (parent) {
                parent.children[item.id] = node;
            } else {
                tree[item.id] = node;
            }
        }
    });

    return tree;
}

function findNodeById(nodes, id) {

    for (let n of Object.values(nodes || {})) {

        if (n.id === id) return n;

        let found = findNodeById(n.children, id);
        if (found) return found;
    }

    return null;
}

function renderSidebar() {

    let html = "";

    function walk(nodes, depth = 0, path = []) {

        for (let id in nodes) {

            let node = nodes[id];

            // ✅ FILE detection (ONLY TRUTH SOURCE)
            // let isFile = !!node.tus_url;
            let isFile = node.type === "file" || !!node.tus_url;

            // ✅ unified file/folder name handling
            let fileName = node.name || node.filename || "";
            let folderName = node.dir_name || "";

            // ✅ FIX: correct path handling for file + folder
            let currentPath = [...path, isFile ? fileName : folderName];
            let pathKey = currentPath.join("/");

            let isOpen = openNodes[pathKey];
            let isActive = (pathKey === stack.join("/"));

            // 🔥 icon logic (UNCHANGED BEHAVIOR)
            let icon = isFile
                ? getFileIcon(fileName)
                : (isOpen ? "📂" : "📁");

            // 🔥 label logic (clean + safe fallback)
            let label = isFile
                ? shortName(fileName, 25)
                : shortName(folderName, 25);

            if(!isFile) {
                html += `<div class="tree-folder ${isActive ? 'active' : ''}"  style="padding-left:${depth * 15}px" onclick="toggleFolder('${pathKey}', ${node.id})">${icon} ${label}</div>`;
            }
            // ✅ FIX: safe recursion (prevents crash on files)
            if (isOpen && node.children) {
                walk(node.children, depth + 1, currentPath);
            }
        }
    }

    walk(TREE);

    document.getElementById("sidebar").innerHTML = html;
}

function renderSidebarOld() {

    let html = "";

    function walk(nodes, depth = 0, path = []) {

        for (let id in nodes) {

            let node = nodes[id];

            let isFile = node.tus_url !== undefined && node.tus_url !== null;

            let currentPath = [...path, node.dir_name || node.filename];
            let pathKey = currentPath.join("/");

            let isOpen = openNodes[pathKey];
            let isActive = (pathKey === stack.join("/"));

            // 🔥 icon logic
            let icon = isFile
                ? getFileIcon(node.filename || node.name || "")
                : (isOpen ? "📂" : "📁");

            // 🔥 name logic (show extension for files)
            let label = isFile
                ? shortName(node.filename || node.name, 25)
                : shortName(node.dir_name, 25);

            html += `
                <div class="tree-folder ${isActive ? 'active' : ''}"
                     style="padding-left:${depth * 15}px"
                     onclick="toggleFolder('${pathKey}', ${node.id})">
    
                    ${icon} ${label}
                </div>
            `;

            if (isOpen) {
                walk(node.children, depth + 1, currentPath);
            }
        }
    }

    walk(TREE);

    document.getElementById("sidebar").innerHTML = html;
}

function renderMain() {

    let html = "";

    // document.getElementById("backBtn").style.display = stack.length ? "inline-block" : "none";
    document.getElementById("backBtn").disabled = stack.length === 0;
    let nodes = currentNode.children || TREE;
     for (let id in nodes) {
        let n = nodes[id];
        // console.log(n)
         //
         let isFile = n.type === "file" || !!n.tus_url;
         let name = isFile ? n.filename : n.dir_name;
         let icon = getFileIcon(name);

         html += `
            <div class="folder ${selectedItem?.id === n.id ? 'active-item' : ''}"
                 title="${name}"
                 
                 onclick="handleClick(${n.id})"
                 ondblclick="handleDblClick(${n.id})">
        
                <div class="icon">${icon}</div>
                <div class="label">${shortName(name, 12)}</div>
        
                ${isFile && n.tus_url ? `
                    <a href="${n.tus_url}" target="_blank"
                       style="display:none"></a>
                ` : ``}
        
            </div>`;

        // let isFile = n.type === "file" || !!n.tus_url;
        // if (isFile && n.tus_url) {
        //     html += `
        //         <a href="${n.tus_url}" target="_blank" style="text-decoration:none; color:inherit;">
        //             <div class="folder" title="${n.filename}">
        //                 <div class="icon">${getFileIcon(n.filename)}</div>
        //                 <div class="label">${shortName(n.filename, 12)}</div>
        //             </div>
        //         </a>
        //     `;
        // } else {
        //     html += `
        //         <div class="folder"
        //              title="${n.dir_name}"
        //              onclick="openFolder('${n.dir_name}', ${n.id})">
        //             <div class="icon">${getFileIcon(n.dir_name)}</div>
        //             <div class="label">${shortName(n.dir_name, 12)}</div>
        //         </div>
        //     `;
        // }

     }

    document.getElementById("view").innerHTML = html;
    // document.getElementById("path").innerText = "📂 ➜ " + (stack.join(" ➜ ") || "Root");
    document.getElementById("path").innerHTML = "📂 ⇨ " +  (stack.length
        ? stack.map((p, i) => {
            const path = stack.slice(0, i + 1).join("/");

            return `<span style="cursor:pointer;"
                        onclick="navigateToPathBreadcrumb('${path}')">
                        ${p}
                    </span>`;
        }).join(" ⇨ ")
        : "Root");

}

function toggleFolderOone(pathKey, id) {

    openNodes[pathKey] = !openNodes[pathKey];

    navigateToPath(pathKey);

    renderSidebar();
    renderMain();
}

async function toggleFolder(pathKey, id) {

    openNodes[pathKey] = !openNodes[pathKey];

    navigateToPath(pathKey);

    // 🔥 LOAD FROM API (append/update children)
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-files/${id}/`);
        const data = await res.json();

        let node = findNodeById(TREE, id);
        if (!node.children) node.children = {};

        data.forEach(item => {

            node.children[item.id] = {
                id: item.id,
                dir_name: item.dir_name || item.name,
                filename: item.name || null,
                file_extension: item.file_extension || (item.name ? item.name.split('.').pop() : null),
                tus_url: item.tus_url || null,
                type: item.type || (item.tus_url ? "file" : "folder"),
                children: {}
            };

        });

    } catch (err) {
        console.error(err);
    }

    renderSidebar();
    renderMain();
}

async function openFolder(name, id) {

    let node = findNodeById(TREE, id);
    if (!node) return;

    currentNode = node;

    stack = buildPath(node);

    try {
        const res = await fetch(`http://127.0.0.1:8000/get-files/${id}/`);
        const data = await res.json();

        // 🔥 APPEND (not replace)
        if (!currentNode.children) {
            currentNode.children = {};
        }

        data.forEach(item => {

            currentNode.children[item.id] = {
                id: item.id,

                // existing fields (safe fallback)
                dir_name: item.dir_name || item.name || "Untitled",
                filename: item.name || null,

                parent_id: item.parent_id ?? null,
                type: item.type || "file",

                // optional fields (ONLY if exist)
                file_dir: item.file_dir ?? null,
                tus_url: item.tus_url ?? null,
                tus_id: item.tus_id ?? null,
                file_extension: item.file_extension ?? (item.name ? item.name.split('.').pop() : null),

                // keep structure
                children: {}
            };

        });

    } catch (err) {
        console.error(err);
    }

    renderSidebar();
    renderMain();
}

function openFolderOld(name, id) {

    let node = findNodeById(TREE, id);
    if (!node) return;

    stack = buildPath(node);
    currentNode = node;
    fetchFiles(node.id);
    renderSidebar();
    renderMain();
}

function buildPath(node, path = []) {

    if (!node) return path;

    let parent = findParent(TREE, node.id);

    if (!parent) return [node.dir_name, ...path];

    return buildPath(parent, [node.dir_name, ...path]);
}

function findParent(nodes, id, parent = null) {

    for (let n of Object.values(nodes || {})) {

        if (n.id === id) return parent;

        let found = findParent(n.children, id, n);
        if (found) return found;
    }

    return null;
}

function navigateToPathBreadcrumb(pathKey) {

    let parts = pathKey.split("/");

    let node = { children: TREE }; // 🔥 FIX HERE

    stack = [];

    for (let p of parts) {

        for (let n of Object.values(node.children)) {

            if (n.dir_name === p) {
                stack.push(p);
                node = n;
                currentNode = n;
                break;
            }
        }
    }

    renderSidebar();
    renderMain();
}

function navigateToPath(pathKey) {

    let parts = pathKey.split("/");

    let node = TREE;
    stack = [];

    for (let p of parts) {

        for (let n of Object.values(node)) {

            if (n.dir_name === p) {
                stack.push(p);
                node = n.children;
                currentNode = n;
                break;
            }
        }
    }
}

function goRoot() {

    currentNode = { children: TREE };
    stack = [];

    renderSidebar();
    renderMain();
}

function saveFolder() {

    let name = document.getElementById("folderNameInput").value.trim();
    if (!name) return;

    // console.log("CURRENT NODE:", currentNode);

    let parentId = currentNode?.id || null;

    fetch("http://127.0.0.1:8000/create-directory/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            dir_name: name,
            parent_id: parentId,
            created_by: 1
        })
    })

    .then(res => res.json())
    .then(data => {

        closeFolderModal();

        // create new node from API response
        const newNode = {
            id: data.id,
            dir_name: name,
            parent_id: parentId,
            children: {}
        };

        // IMPORTANT: update BOTH current view + TREE reference

        currentNode.children[newNode.id] = newNode;

        // also update TREE (so sidebar is correct)
        function insertIntoTree(nodes) {
            if (nodes[currentNode.id]) {
                nodes[currentNode.id].children[newNode.id] = newNode;
                return true;
            }

            for (let n of Object.values(nodes)) {
                if (insertIntoTree(n.children)) return true;
            }
            return false;
        }

        insertIntoTree(TREE);

        renderSidebar();
        renderMain();
    })
}

function goBack() {

    stack.pop();

    if (stack.length === 0) {
        goRoot();
        return;
    }

    navigateToPath(stack.join("/"));

    renderSidebar();
    renderMain();
}

function openFolderModal() {
    document.getElementById("folderModal").style.display = "flex";
    document.getElementById("folderNameInput").value = "";
    document.getElementById("folderNameInput").focus();
}

function closeFolderModal() {
    document.getElementById("folderModal").style.display = "none";
}

function shortName(name, fontSize) {
    if (!name) return "";

    const max = 20;

    if (name.length <= max) return name;

    return name.substring(0, fontSize) + "...";
}

function getFileIcon(filename) {
    if (!filename) return "📄";

    const ext = filename.split('.').pop().toLowerCase();

    const icons = {
        // documents
        pdf: "📕",
        doc: "📄",
        docx: "📄",
        txt: "📝",

        // excel
        xls: "📊",
        xlsx: "📊",
        csv: "📑",

        // images
        jpg: "🖼️",
        jpeg: "🖼️",
        png: "🖼️",
        gif: "🖼️",

        // video
        mp4: "🎬",
        mkv: "🎬",
        mov: "🎬",
        avi: "🎬",
        flv: "🎬",

        // audio
        mp3: "🎵",
        wav: "🎵",

        // archive
        zip: "🗜️",
        rar: "🗜️",
        tar: "🗜️",
        gz: "🗜️",
    };

    return icons[ext] || "📁";
}

function handleDblClick(id) {

    clearTimeout(clickTimer);

    let n = findNodeById(currentNode.children, id)
         || findNodeById(TREE, id);

    if (!n) return;

    if (n.tus_url) {
        window.open(n.tus_url, "_blank");
    } else {
        openFolder(n.dir_name, n.id);
    }
}

function handleClick(id) {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        // keep old system (for UI)
        selectedItem = findNodeById(currentNode.children, id) || findNodeById(TREE, id);

        // 🔥 ADD THIS (for buttons)
        selectedId = id;

        renderMain();
        renderSidebar?.(); // optional if you use sidebar
        updateActionButtons();

    }, 200);
}

function updateActionButtons() {
    const box = document.getElementById("actionButtons");
    if (!selectedId) {
        box.style.display = "none";
        return;
    }
    // optional safety check (ensure node exists)
    const node = findNodeById(TREE, selectedId);
    box.style.display = node ? "flex" : "none";
}

function renameItem() {

    if (!selectedId) return;
    let node = findNodeById(TREE, selectedId);
    if (!node) return;
    openRenameModal(node);   // ✅ USE MODAL ONLY
}

function openRenameModal(node) {
    selectedItem = node;
    document.getElementById("renameInput").value =
        node.dir_name || node.filename || "";
    document.getElementById("renameModal").style.display = "flex";

    setTimeout(() => {
        document.getElementById("renameInput").focus();
    }, 100);
}

function closeRenameModal() {
    document.getElementById("renameModal").style.display = "none";
}

function submitRename() {

    if (!selectedItem) return;

    let newName = document.getElementById("renameInput").value.trim();

    if (!newName) return;

    let isFile = selectedItem.type === "file" || !!selectedItem.tus_url;

    // 🔥 choose correct API
    let url = isFile
        ? `http://127.0.0.1:8000/rename-file/${selectedItem.id}/`
        : `http://127.0.0.1:8000/rename-folder/${selectedItem.id}/`;

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: newName
        })
    })
    .then(res => res.json())
    .then(() => {

        // 🔥 update UI instantly (NO reload needed)
        if (isFile) {
            selectedItem.filename = newName;
        } else {
            selectedItem.dir_name = newName;
        }

        closeRenameModal();

        renderMain();
        renderSidebar();
    })
    .catch(err => {
        console.error("Rename failed:", err);
    });
}

function deleteItem() {

    if (!selectedItem) return;

    deleteTarget = selectedItem;

    let name = deleteTarget.dir_name || deleteTarget.filename;

    document.getElementById("deleteText").innerText =
        `Are you sure you want to delete: ${name}?`;

    document.getElementById("deleteReason").value = "";

    document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
    document.getElementById("deleteModal").style.display = "none";
    deleteTarget = null;
}

function confirmDelete() {

    let reason = document.getElementById("deleteReason").value.trim();
    let errorBox = document.getElementById("deleteError");

    // 🔥 FRONTEND VALIDATION
    if (!reason) {
        errorBox.style.display = "block";
        return;
    }

    errorBox.style.display = "none";

    if (!deleteTarget) return;

    let isFile = deleteTarget.type === "file" || !!deleteTarget.tus_url;

    let url = isFile
        ? `http://127.0.0.1:8000/delete-file/${deleteTarget.id}/`
        : `http://127.0.0.1:8000/delete-dir/${deleteTarget.id}/`;

    fetch(url, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            reason: reason
        })
    })
    .then(res => res.json())
    .then(data => {

        if (data.error) {
            errorBox.innerText = data.error;
            errorBox.style.display = "block";
            return;
        }

        removeFromTree(deleteTarget.id);

        closeDeleteModal();

        renderMain();
        renderSidebar();
    });
}

function removeFromTree(id, nodes = TREE) {

    for (let key in nodes) {

        if (nodes[key].id === id) {
            delete nodes[key];
            return true;
        }

        if (nodes[key].children) {
            let found = removeFromTree(id, nodes[key].children);
            if (found) return true;
        }
    }
    return false;
}

loadTree();

