// ============================================================
//  admin.js — K_Tawiah Admin Dashboard
//  Handles: Auth check, user listing, role change, deletion,
//           adding new students/teachers via Firebase Admin SDK
//           (client-side Firestore only — no Auth creation from
//           client; new users must self-register then be promoted)
// ============================================================

// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
    authDomain: "reportbase-669ff.firebaseapp.com",
    projectId: "reportbase-669ff",
    storageBucket: "reportbase-669ff.firebasestorage.app",
    messagingSenderId: "244941864396",
    appId: "1:244941864396:web:aebc946e160a0172edf169",
    measurementId: "G-KBTRR8YZFJ"
};

// 3. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let allUsers      = [];   // all user docs from Firestore
let pendingDelete = null; // uid to delete
let pendingRole   = null; // {uid, name} for role change

// ── Auth Guard ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) { showDenied(); return; }

        const data = userDoc.data();
        if (data.role !== "admin") { showDenied(); return; }

        // Show dashboard
        const name = data.firstName || data.firstname || "Admin";
        document.getElementById("admin-welcome").innerText =
            `Welcome back, ${name}. You have full access.`;
        document.getElementById("dashboard-main").style.display = "block";
        document.getElementById("access-denied").style.display  = "none";

        // Load all users
        await loadAllUsers();

    } catch (err) {
        console.error("Auth check error:", err);
        showDenied();
    }
});

function showDenied() {
    document.getElementById("dashboard-main").style.display = "none";
    document.getElementById("access-denied").style.display  = "block";
}

// ── Load All Users ─────────────────────────────────────────
async function loadAllUsers() {
    try {
        const snap = await getDocs(collection(db, "users"));
        allUsers = [];
        snap.forEach(d => allUsers.push({ uid: d.id, ...d.data() }));

        renderTable("student", allUsers.filter(u => u.role === "student"));
        renderTable("teacher", allUsers.filter(u => u.role === "teacher" || u.role === "admin"));
        updateStats(allUsers);

    } catch (err) {
        console.error("Error loading users:", err);
    }
}

// ── Update Stat Cards ──────────────────────────────────────
function updateStats(users) {
    document.getElementById("total-students").innerText =
        users.filter(u => u.role === "student").length;
    document.getElementById("total-teachers").innerText =
        users.filter(u => u.role === "teacher").length;
    document.getElementById("total-admins").innerText =
        users.filter(u => u.role === "admin").length;
}

// ── Render Table ───────────────────────────────────────────
function renderTable(type, users) {
    const tbody = document.getElementById(`${type}-tbody`);
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No ${type}s found.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const name  = `${u.firstName || u.firstname || ""} ${u.lastName || u.lastname || ""}`.trim() || "—";
        const email = u.email || "—";
        const role  = u.role  || "unknown";
        const uid   = u.uid;

        return `<tr data-search="${name.toLowerCase()} ${email.toLowerCase()}">
            <td>${name}</td>
            <td>${email}</td>
            <td><span class="role-badge ${role}">${role}</span></td>
            <td style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;">${uid.slice(0,12)}…</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit"   onclick="openRoleModal('${uid}','${name}','${role}')">✏️ Role</button>
                    <button class="btn-delete" onclick="openDeleteModal('${uid}','${name}')">🗑️ Remove</button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

// ── Filter Table (search) ──────────────────────────────────
window.filterTable = function(tableId, query) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    const q = query.toLowerCase();
    rows.forEach(row => {
        const search = row.getAttribute("data-search") || "";
        row.style.display = search.includes(q) ? "" : "none";
    });
};

// ── Tab Switching ──────────────────────────────────────────
window.switchTab = function(name) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    const btn = document.querySelector(`.tab-btn[onclick="switchTab('${name}')"]`);
    const tab = document.getElementById(`tab-${name}`);
    if (btn) btn.classList.add("active");
    if (tab) tab.classList.add("active");
};

// ── Add User ───────────────────────────────────────────────
// NOTE: Firebase client SDK only allows creating auth users while
// signed in as that new user. To truly create accounts server-side
// you'd need Cloud Functions / Firebase Admin SDK.
// This approach: creates the Auth account, stores Firestore doc,
// then re-signs-in the admin. Works for small schools.

window.addUser = async function(role) {
    const prefix   = role === "student" ? "s" : "t";
    const fname    = document.getElementById(`${prefix}-firstname`).value.trim();
    const lname    = document.getElementById(`${prefix}-lastname`).value.trim();
    const email    = document.getElementById(`${prefix}-email`).value.trim();
    const password = document.getElementById(`${prefix}-password`).value;
    const msgEl    = document.getElementById(`${prefix}-msg`);

    msgEl.className = "form-msg";
    msgEl.innerText = "";

    // Basic validation
    if (!fname || !lname || !email || !password) {
        return showFormMsg(msgEl, "error", "All fields are required.");
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return showFormMsg(msgEl, "error", "Password too weak (8+ chars, 1 upper, 1 number).");
    }

    showFormMsg(msgEl, "", "Creating account...");

    try {
        // Save admin's current auth token so we can re-sign them in
        const adminUser = auth.currentUser;

        // Create new user
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const newUid = cred.user.uid;

        // Write Firestore doc
        await setDoc(doc(db, "users", newUid), {
            firstName: fname,
            lastName:  lname,
            email:     email,
            role:      role
        });

        showFormMsg(msgEl, "success",
            `✅ ${role.charAt(0).toUpperCase() + role.slice(1)} account created for ${fname}!`);

        // Clear fields
        [`${prefix}-firstname`,`${prefix}-lastname`,`${prefix}-email`,`${prefix}-password`]
            .forEach(id => document.getElementById(id).value = "");

        // Firebase automatically signs in the new user — we need to sign
        // the admin back in. Redirect to force re-auth.
        alert(`Account created for ${fname} ${lname}.\n\nIMPORTANT: You have been signed out of the new account. Please sign in again as admin.`);
        window.location.href = "index.html";

    } catch (err) {
        const msgs = {
            "auth/email-already-in-use": "That email is already registered.",
            "auth/invalid-email":        "Invalid email address.",
            "auth/weak-password":        "Password is too weak."
        };
        showFormMsg(msgEl, "error", msgs[err.code] || err.message);
    }
};

function showFormMsg(el, type, text) {
    el.className = `form-msg ${type}`;
    el.innerText = text;
}

// ── Delete Modal ───────────────────────────────────────────
window.openDeleteModal = function(uid, name) {
    pendingDelete = uid;
    document.getElementById("modal-msg").innerText =
        `Are you sure you want to remove "${name}" from the system?`;
    document.getElementById("modal").style.display = "flex";

    document.getElementById("modal-confirm").onclick = async () => {
        await deleteUser(pendingDelete);
        closeModal();
    };
};

window.closeModal = function() {
    document.getElementById("modal").style.display = "none";
    pendingDelete = null;
};

async function deleteUser(uid) {
    try {
        await deleteDoc(doc(db, "users", uid));
        // Note: Firebase Auth deletion requires Admin SDK or user self-deletion.
        // This removes the Firestore record (blocks access), which is sufficient
        // since auth check reads role from Firestore on every page load.
        await loadAllUsers();
        alert("User record removed from the system.");
    } catch (err) {
        alert("Error removing user: " + err.message);
    }
}

// ── Role Modal ─────────────────────────────────────────────
window.openRoleModal = function(uid, name, currentRole) {
    pendingRole = { uid, name };
    document.getElementById("role-modal-name").innerText = `Changing role for: ${name}`;
    document.getElementById("new-role").value = currentRole;
    document.getElementById("role-modal").style.display = "flex";

    document.getElementById("role-confirm").onclick = async () => {
        const newRole = document.getElementById("new-role").value;
        await changeRole(pendingRole.uid, newRole);
        closeRoleModal();
    };
};

window.closeRoleModal = function() {
    document.getElementById("role-modal").style.display = "none";
    pendingRole = null;
};

async function changeRole(uid, newRole) {
    try {
        await updateDoc(doc(db, "users", uid), { role: newRole });
        await loadAllUsers();
        alert(`Role updated to "${newRole}" successfully.`);
    } catch (err) {
        alert("Error updating role: " + err.message);
    }
}

// ── Toggle Menu ────────────────────────────────────────────
window.toggleMenu = function() {
    document.getElementById("navover")?.classList.toggle("open");
    document.getElementById("navigation")?.classList.toggle("is-active");
};

// Close modals on overlay click
document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal")) closeModal();
});
document.getElementById("role-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("role-modal")) closeRoleModal();
});

console.log("Admin dashboard ready.");