let TREE = {};
let currentNode = { children: {} };
let stack = [];
let openNodes = {};

/* ================= LOAD TREE ================= */
async function loadTree() {

    const res = await fetch("http://192.168.1.52:8000/get-directory");
    const data = await res.json();

    TREE = buildTree(data);

    currentNode = { children: TREE };
    stack = [];

    renderSidebar();
    renderMain();
}

/* ================= BUILD TREE ================= */
function buildTree(list) {

    let map = {};
    let tree = {};

    // create nodes
    list.forEach(item => {
        map[item.id] = {
            id: item.id,
            dir_name: item.dir_name,
            parent_id: item.parent_id,
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

/* ================= FIND NODE ================= */
function findNodeById(nodes, id) {

    for (let n of Object.values(nodes || {})) {

        if (n.id === id) return n;

        let found = findNodeById(n.children, id);
        if (found) return found;
    }

    return null;
}

/* ================= SIDEBAR ================= */
function renderSidebar() {

    let html = "";

    function walk(nodes, depth = 0, path = []) {

        for (let id in nodes) {

            let node = nodes[id];

            let currentPath = [...path, node.dir_name];
            let pathKey = currentPath.join("/");

            let isOpen = openNodes[pathKey];
            let isActive = (pathKey === stack.join("/"));

            html += `
                <div class="tree-folder ${isActive ? 'active' : ''}"
                     style="padding-left:${depth * 15}px"
                     onclick="toggleFolder('${pathKey}', ${node.id})">

                    ${isOpen ? "📂" : "📁"} ${node.dir_name}
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

/* ================= TOGGLE FOLDER ================= */
function toggleFolder(pathKey, id) {

    openNodes[pathKey] = !openNodes[pathKey];

    navigateToPath(pathKey);

    renderSidebar();
    renderMain();
}

/* ================= OPEN FOLDER ================= */
function openFolder(name, id) {

    let node = findNodeById(TREE, id);
    if (!node) return;

    stack = buildPath(node);
    currentNode = node;

    renderSidebar();
    renderMain();
}

/* ================= BUILD PATH ================= */
function buildPath(node, path = []) {

    if (!node) return path;

    let parent = findParent(TREE, node.id);

    if (!parent) return [node.dir_name, ...path];

    return buildPath(parent, [node.dir_name, ...path]);
}

/* ================= FIND PARENT ================= */
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


/* ================= NAVIGATE ================= */
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
let pathSoFar = [];
/* ================= MAIN VIEW ================= */
function renderMain() {

    let html = "";

    // document.getElementById("backBtn").style.display = stack.length ? "inline-block" : "none";
    document.getElementById("backBtn").disabled = stack.length === 0;
    let nodes = currentNode.children || TREE;

    for (let id in nodes) {

        let n = nodes[id];

        html += `
            <div class="folder"
                 onclick="openFolder('${n.dir_name}', ${n.id})">

                <div class="icon">📁</div>
                <div class="label">${n.dir_name}</div>
            </div>
        `;
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
// ←   →

/* ================= GO ROOT ================= */
function goRoot() {

    currentNode = { children: TREE };
    stack = [];

    renderSidebar();
    renderMain();
}

/* ================= SAVE FOLDER ================= */
function saveFolder() {

    let name = document.getElementById("folderNameInput").value.trim();
    if (!name) return;

    console.log("CURRENT NODE:", currentNode);

    let parentId = currentNode?.id || null;

    fetch("http://192.168.1.52:8000/create-directory/", {
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

/* ================= BACK ================= */
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

/* ================= INIT ================= */
loadTree();


function openFolderModal() {
    document.getElementById("folderModal").style.display = "flex";
    document.getElementById("folderNameInput").value = "";
    document.getElementById("folderNameInput").focus();
}

function closeFolderModal() {
    document.getElementById("folderModal").style.display = "none";
}
