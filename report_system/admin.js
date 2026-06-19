// ============================================================
//  admin.js — K_Tawiah Admin Dashboard
//  Tabs: Overview, Teachers, Students, Classes, Results, Profile
//  No onclick in HTML — all wired via addEventListener
// ============================================================

// 1. IMPORTS
import { initializeApp }                from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth,
         onAuthStateChanged,
         signOut,
         updatePassword,
         EmailAuthProvider,
         reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc, setDoc,
         updateDoc, deleteDoc,
         collection, getDocs,
         query, where, addDoc,
         serverTimestamp }              from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig,
         getDepartment,
         DEPARTMENT_SUBJECTS,
         generateIndexNumber,
         validatePhone,
         validatePassword,
         sanitizeInput,
         showNotification,
         resolveRole,
         hasRole,
         sendEmailNotification,
         MESSAGES }                     from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let currentAdmin     = null;
let allClasses       = [];
let pendingDelete    = { uid: null, type: null };
let assigningTeacher = { uid: null, name: null };

// ============================================================
//  HELPERS
// ============================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "flex";
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
}

function showDenied() {
    console.warn("Access denied — redirecting.");
    window.location.href = "index.html";
}

// ============================================================
//  AUTH GUARD — inside DOMContentLoaded so DOM is ready
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "index.html"; return; }

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (!snap.exists()) { showDenied(); return; }

            const data  = snap.data();
            // resolveRole returns a normalized array e.g. ["admin", "teacher"]
            // This handles trailing spaces and comma-separated strings safely.
            const roles = resolveRole(data.role);

            if (!hasRole(roles, "admin")) { showDenied(); return; }

            currentAdmin = { uid: user.uid, ...data };

            // Show dashboard
            const dashEl   = document.getElementById("dashboard");
            const deniedEl = document.getElementById("access-denied");
            if (dashEl)   dashEl.style.display   = "block";
            if (deniedEl) deniedEl.style.display = "none";

            const name = data.firstName || data.firstname || "Admin";
            document.getElementById("admin-welcome").innerText =
                `Welcome back, ${name}. You have full control.`;

            // ── Teacher Swap Button ──────────────────────────────
            // Uses resolveRole so trailing spaces like "admin " are
            // normalized before the includes() check — avoids false
            // negatives on dual-role accounts stored with whitespace.
            const isAlsoTeacher = hasRole(roles, "teacher");

            const swapBtn = document.getElementById("btn-switch-teacher");
            if (swapBtn && isAlsoTeacher) {
                swapBtn.style.display = "inline-flex";
            }
            // ────────────────────────────────────────────────────

            // Prefill profile
            document.getElementById("profile-firstname").value = data.firstName || "";
            document.getElementById("profile-lastname").value  = data.lastName  || "";
            document.getElementById("profile-phone").value     = data.phone     || "";

            // Load data
            await Promise.all([loadClasses(), loadAllUsers(), loadResultsLog()]);

        } catch (err) {
            console.error("Auth error:", err);
            showDenied();
        }
    });

    // ── Tab Switching ────────────────────────────────────────
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn")
                .forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content")
                .forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`tab-${btn.dataset.tab}`)
                ?.classList.add("active");
        });
    });

    // ── Modal Overlay Close ──────────────────────────────────
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // ── Event Delegation for Dynamic Buttons ─────────────────
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const { action, uid, name } = btn.dataset;

        if      (action === "approve")        approveTeacher(uid);
        else if (action === "reject")         rejectTeacher(uid);
        else if (action === "assign")         openAssignModal(uid, name);
        else if (action === "remove-teacher") openDeleteModal(uid, "teacher",
            `Remove teacher "${name}" from the system?`);
        else if (action === "remove-student") openDeleteModal(uid, "student",
            `Remove student "${name}" from the system?`);
        else if (action === "remove-class")   openDeleteModal(uid, "class",
            `Remove class "${uid}"? Students will not be deleted.`);
    });

    // ── Nav Menu ─────────────────────────────────────────────
    document.getElementById("btn-menu")
        ?.addEventListener("click", () => {
            document.getElementById("navover")?.classList.toggle("open");
            document.getElementById("btn-menu")?.classList.toggle("is-active");
        });

    // ── Sign Out ─────────────────────────────────────────────
    document.getElementById("nav-signout")
        ?.addEventListener("click", async (e) => {
            e.preventDefault();
            await signOut(auth);
            window.location.href = "index.html";
        });

    // ── Switch to Teacher View ───────────────────────────────
    // Sets a sessionStorage flag so teacher.js knows this is an
    // admin acting as teacher, then opens teacher.html in a new tab.
    // sessionStorage is tab-scoped — it clears automatically when
    // the teacher tab is closed.
    document.getElementById("btn-switch-teacher")
        ?.addEventListener("click", () => {
            sessionStorage.setItem("adminAsTeacher", "true");
            window.open("teacher.html", "_blank");
        });
    // ────────────────────────────────────────────────────────

    // ── Add Student Modal ────────────────────────────────────
    document.getElementById("btn-open-add-student")
        ?.addEventListener("click", () => openModal("modal-add-student"));
    document.getElementById("btn-cancel-add-student")
        ?.addEventListener("click", () => closeModal("modal-add-student"));
    document.getElementById("btn-confirm-add-student")
        ?.addEventListener("click", addStudent);

    // Live index number preview when class is selected
    document.getElementById("ns-class")
        ?.addEventListener("change", async (e) => {
            const code = e.target.value;
            if (!code) return;
            const preview = await generateIndexNumber(
                db, code, getDocs, collection, query, where
            );
            document.getElementById("index-preview-val").innerText = preview || "—";
            document.getElementById("index-preview").style.display = "block";
        });

    // ── Add Class Modal ──────────────────────────────────────
    document.getElementById("btn-open-add-class")
        ?.addEventListener("click", () => openModal("modal-add-class"));
    document.getElementById("btn-cancel-add-class")
        ?.addEventListener("click", () => closeModal("modal-add-class"));
    document.getElementById("btn-confirm-add-class")
        ?.addEventListener("click", addClass);

    // Live department preview as class code is typed
    document.getElementById("nc-code")
        ?.addEventListener("input", (e) => {
            const code = e.target.value.toUpperCase();
            const dept = getDepartment(code);
            const el   = document.getElementById("dept-preview");
            if (el) el.innerText = code ? `Department: ${dept}` : "";
        });

    // ── Assign Subjects Modal ────────────────────────────────
    document.getElementById("btn-cancel-assign")
        ?.addEventListener("click", () => closeModal("modal-assign"));
    document.getElementById("btn-confirm-assign")
        ?.addEventListener("click", saveAssignments);

    // ── Delete Modal ─────────────────────────────────────────
    document.getElementById("btn-cancel-delete")
        ?.addEventListener("click", () => closeModal("modal-delete"));
    document.getElementById("btn-confirm-delete")
        ?.addEventListener("click", confirmDelete);

    // ── Publish Results ──────────────────────────────────────
    document.getElementById("btn-publish")
        ?.addEventListener("click", publishResults);

    // ── Search & Filter ──────────────────────────────────────
    document.getElementById("teacher-search")
        ?.addEventListener("input", (e) =>
            filterTable("teacher-tbody", e.target.value));
    document.getElementById("student-search")
        ?.addEventListener("input", (e) =>
            filterTable("student-tbody", e.target.value));
    document.getElementById("student-class-filter")
        ?.addEventListener("change", (e) =>
            filterStudentsByClass(e.target.value));

    // ── Profile ──────────────────────────────────────────────
    document.getElementById("btn-update-profile")
        ?.addEventListener("click", updateProfile);
    document.getElementById("btn-change-password")
        ?.addEventListener("click", changePassword);
});

// ============================================================
//  LOAD CLASSES
// ============================================================
async function loadClasses() {
    try {
        const snap = await getDocs(collection(db, "classes"));
        allClasses = [];
        snap.forEach(d => allClasses.push({ id: d.id, ...d.data() }));
        allClasses.sort((a, b) => a.id.localeCompare(b.id));

        renderClassesGrid();
        populateClassDropdowns();
        document.getElementById("stat-classes").innerText = allClasses.length;
    } catch (err) {
        console.error("Load classes error:", err);
    }
}

function renderClassesGrid() {
    const grid = document.getElementById("classes-grid");
    if (!allClasses.length) {
        grid.innerHTML = `<p class="loading-row">No classes yet. Add one above.</p>`;
        return;
    }
    grid.innerHTML = allClasses.map(c => `
        <div class="class-card">
            <div class="class-card-code">${c.id}</div>
            <div class="class-card-name">${c.name || ""}</div>
            <div class="class-card-dept">${c.department || getDepartment(c.id)}</div>
            <div class="class-card-count">
                Students: <strong>${c.studentCount || 0}</strong>
            </div>
            <div class="class-card-actions">
                <button class="btn-danger"
                    data-action="remove-class"
                    data-uid="${c.id}">
                    🗑️ Remove
                </button>
            </div>
        </div>
    `).join("");
}

function populateClassDropdowns() {
    ["ns-class", "student-class-filter", "publish-class"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const firstOption = el.options[0];
        el.innerHTML = "";
        el.appendChild(firstOption);
        allClasses.forEach(c => {
            const opt       = document.createElement("option");
            opt.value       = c.id;
            opt.textContent = `${c.id} — ${c.name || ""}`;
            el.appendChild(opt);
        });
    });
}

// ============================================================
//  LOAD ALL USERS
// ============================================================
async function loadAllUsers() {
    try {
        const snap     = await getDocs(collection(db, "users"));
        const students = [], teachers = [], pending = [], recent = [];

        snap.forEach(d => {
            const data  = { uid: d.id, ...d.data() };
            const roles = resolveRole(data.role);

            if (data.accountStatus === "pending")   pending.push(data);
            else if (hasRole(roles, "student"))     students.push(data);
            else if (hasRole(roles, "teacher") || hasRole(roles, "admin")) teachers.push(data);

            if (hasRole(roles, "student") && data.createdAt) recent.push(data);
        });

        recent.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

        document.getElementById("stat-students").innerText = students.length;
        document.getElementById("stat-teachers").innerText = teachers.length;
        document.getElementById("stat-pending").innerText  = pending.length;

        renderPendingTable(pending);
        renderTeacherTable(teachers);
        renderStudentTable(students);
        renderRecentStudents(recent.slice(0, 5));

    } catch (err) {
        console.error("Load users error:", err);
    }
}

// ============================================================
//  RENDER TABLES
// ============================================================
function renderPendingTable(users) {
    const tbody = document.getElementById("pending-tbody");
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No pending approvals.</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        const date = u.createdAt?.toDate
            ? u.createdAt.toDate().toLocaleDateString() : "—";
        return `<tr>
            <td>${name}</td>
            <td>${u.email || "—"}</td>
            <td>${u.phone || "—"}</td>
            <td>${date}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-success"
                        data-action="approve" data-uid="${u.uid}">
                        ✓ Approve
                    </button>
                    <button class="btn-danger"
                        data-action="reject" data-uid="${u.uid}">
                        ✗ Reject
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function renderTeacherTable(users) {
    const tbody = document.getElementById("teacher-tbody");
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No teachers found.</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const name      = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        const roles     = resolveRole(u.role);
        const status    = u.accountStatus || "active";
        const subjCount = u.assignedSubjects?.length || 0;
        const isAdmin   = hasRole(roles, "admin");
        return `<tr data-search="${name.toLowerCase()} ${(u.email||"").toLowerCase()}">
            <td>${name}</td>
            <td>${u.email || "—"}</td>
            <td>${u.phone || "—"}</td>
            <td>
                <span class="badge badge-${status}">${status}</span>
                ${isAdmin
                    ? `<span class="badge badge-admin" style="margin-left:4px">admin</span>`
                    : ""}
            </td>
            <td>${subjCount} subject${subjCount !== 1 ? "s" : ""}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-secondary"
                        data-action="assign"
                        data-uid="${u.uid}"
                        data-name="${name}">
                        📚 Assign
                    </button>
                    <button class="btn-danger"
                        data-action="remove-teacher"
                        data-uid="${u.uid}"
                        data-name="${name}">
                        🗑️ Remove
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function renderStudentTable(users) {
    const tbody = document.getElementById("student-tbody");
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No students found.</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const name   = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        const status = u.accountStatus || "active";
        return `<tr
            data-search="${name.toLowerCase()} ${(u.indexNo||"").toLowerCase()}"
            data-class="${u.classCode || ""}">
            <td>${name}</td>
            <td>
                <span style="font-family:'Cinzel',serif;
                             font-size:0.8rem;
                             color:var(--gold-light)">
                    ${u.indexNo || "—"}
                </span>
            </td>
            <td>${u.classCode || "—"}</td>
            <td>${u.phone || "—"}</td>
            <td><span class="badge badge-${status}">${status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-danger"
                        data-action="remove-student"
                        data-uid="${u.uid}"
                        data-name="${name}">
                        🗑️ Remove
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function renderRecentStudents(students) {
    const tbody = document.getElementById("recent-students-tbody");
    if (!students.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No students yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = students.map(u => {
        const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        return `<tr>
            <td>${name}</td>
            <td><span style="font-family:'Cinzel',serif;font-size:0.8rem;color:var(--gold-light)">${u.indexNo || "—"}</span></td>
            <td>${u.classCode || "—"}</td>
            <td>${u.createdBy || "Admin"}</td>
        </tr>`;
    }).join("");
}

// ============================================================
//  APPROVE / REJECT TEACHER
// ============================================================
async function approveTeacher(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return;
        const data = snap.data();

        await updateDoc(doc(db, "users", uid), {
            role:          "teacher",
            accountStatus: "active"
        });

        await sendEmailNotification(
            data.email,
            "Your K_Tawiah Teacher Account Has Been Approved",
            `Hello ${data.firstName},\n\nYour teacher account has been approved. You can now sign in.`,
            db
        );

        showNotification(`${data.firstName} approved as a teacher.`, "success");
        await loadAllUsers();
    } catch (err) {
        console.error("Approve error:", err);
        showNotification("Could not approve teacher.", "error");
    }
}

async function rejectTeacher(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return;
        const data = snap.data();

        await updateDoc(doc(db, "users", uid), { accountStatus: "suspended" });

        await sendEmailNotification(
            data.email,
            "K_Tawiah Account Application Update",
            `Hello ${data.firstName},\n\nYour teacher account application has not been approved. Please contact your administrator.`,
            db
        );

        showNotification(`${data.firstName}'s account rejected.`, "warning");
        await loadAllUsers();
    } catch (err) {
        console.error("Reject error:", err);
        showNotification("Could not reject teacher.", "error");
    }
}

// ============================================================
//  ADD STUDENT
// ============================================================
async function addStudent() {
    const fname     = sanitizeInput(document.getElementById("ns-firstname").value.trim());
    const lname     = sanitizeInput(document.getElementById("ns-lastname").value.trim());
    const classCode = document.getElementById("ns-class").value;
    const phone     = sanitizeInput(document.getElementById("ns-phone").value.trim());
    const email     = sanitizeInput(document.getElementById("ns-email").value.trim());

    if (!fname || !lname || !classCode) {
        showNotification("First name, last name and class are required.", "error"); return;
    }
    if (phone && !validatePhone(phone)) {
        showNotification("Invalid phone number format.", "error"); return;
    }

    try {
        showNotification("Creating student...", "info");

        // generateIndexNumber in config.js takes (classCode, position)
        // Count existing students in class first
        const existingSnap = await getDocs(
            query(collection(db, "users"),
                  where("classCode", "==", classCode),
                  where("role", "==", "student"))
        );
        const nextPosition = existingSnap.size + 1;
        const indexNo      = generateIndexNumber(classCode, nextPosition);

        await setDoc(doc(db, "users", indexNo), {
            firstName:     fname,
            lastName:      lname,
            classCode,
            indexNo,
            phone:         phone || "",
            email:         email || "",
            role:          "student",
            accountStatus: "pending",
            createdBy:     currentAdmin?.uid || "admin",
            createdAt:     serverTimestamp()
        });

        // Update class student count
        const classRef  = doc(db, "classes", classCode);
        const classSnap = await getDoc(classRef);
        if (classSnap.exists()) {
            await updateDoc(classRef, {
                studentCount: (classSnap.data().studentCount || 0) + 1
            });
        }

        document.getElementById("index-preview-val").innerText = indexNo;
        document.getElementById("index-preview").style.display = "block";

        showNotification(
            `Student added! Index No: ${indexNo}. Hand credentials manually.`,
            "success"
        );

        ["ns-firstname","ns-lastname","ns-phone","ns-email"].forEach(id => {
            document.getElementById(id).value = "";
        });
        document.getElementById("ns-class").value = "";

        await loadAllUsers();
        await loadClasses();

    } catch (err) {
        console.error("Add student error:", err);
        showNotification("Could not add student.", "error");
    }
}

// ============================================================
//  ADD CLASS
// ============================================================
async function addClass() {
    const code = sanitizeInput(
        document.getElementById("nc-code").value.trim().toUpperCase()
    );
    const name = sanitizeInput(document.getElementById("nc-name").value.trim());

    if (!code || !name) {
        showNotification("Class code and name are required.", "error"); return;
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
        showNotification("Class code must only contain letters and numbers.", "error"); return;
    }

    try {
        const existing = await getDoc(doc(db, "classes", code));
        if (existing.exists()) {
            showNotification(`Class "${code}" already exists.`, "error"); return;
        }

        const dept = getDepartment(code);

        await setDoc(doc(db, "classes", code), {
            name,
            department:   dept,
            studentCount: 0,
            createdAt:    serverTimestamp(),
            createdBy:    currentAdmin?.uid || "admin"
        });

        showNotification(`Class "${code}" added!`, "success");
        closeModal("modal-add-class");
        document.getElementById("nc-code").value = "";
        document.getElementById("nc-name").value = "";
        document.getElementById("dept-preview").innerText = "";

        await loadClasses();
    } catch (err) {
        console.error("Add class error:", err);
        showNotification("Could not add class.", "error");
    }
}

// ============================================================
//  ASSIGN SUBJECTS TO TEACHER
//  Only shows classes that belong to the subject's department
// ============================================================
async function openAssignModal(uid, name) {
    assigningTeacher = { uid, name };
    document.getElementById("assign-teacher-label").innerText = `Teacher: ${name}`;

    // Load teacher's current assignments
    const snap       = await getDoc(doc(db, "users", uid));
    const current    = snap.data()?.assignedSubjects || [];
    const currentMap = {};
    current.forEach(a => { currentMap[a.subject] = a.classes || []; });

    const list = document.getElementById("assign-subjects-list");
    list.innerHTML = "";

    // Group by department for a cleaner UI
    Object.entries(DEPARTMENT_SUBJECTS).forEach(([dept, subjects]) => {
        // Get classes that belong to this department
        const deptClasses = allClasses.filter(c => getDepartment(c.id) === dept);
        if (!deptClasses.length) return; // skip if no classes added for this dept yet

        const deptBlock = document.createElement("div");
        deptBlock.style.marginBottom = "20px";
        deptBlock.innerHTML = `
            <div style="font-family:'Cinzel',serif;font-size:0.75rem;
                        color:var(--gold);letter-spacing:0.1em;
                        text-transform:uppercase;margin-bottom:10px;
                        padding-bottom:6px;border-bottom:1px solid var(--glass-border)">
                ${dept}
            </div>
        `;

        subjects.forEach(subj => {
            const assignedClasses = currentMap[subj] || [];
            const chips = deptClasses.map(c => `
                <span class="class-chip ${assignedClasses.includes(c.id) ? "selected" : ""}"
                      data-subject="${subj}"
                      data-class="${c.id}">
                    ${c.id}
                </span>
            `).join("");

            deptBlock.innerHTML += `
                <div class="assign-subject-row">
                    <div class="assign-subject-name">${subj}</div>
                    <div class="assign-classes-wrap">${chips}</div>
                </div>
            `;
        });

        list.appendChild(deptBlock);
    });

    // Toggle chips
    list.querySelectorAll(".class-chip").forEach(chip => {
        chip.addEventListener("click", () => chip.classList.toggle("selected"));
    });

    openModal("modal-assign");
}

async function saveAssignments() {
    if (!assigningTeacher.uid) return;

    const assignedSubjects = [];

    // Collect all selected chips
    document.querySelectorAll(".class-chip.selected").forEach(chip => {
        const subj  = chip.dataset.subject;
        const cls   = chip.dataset.class;
        const entry = assignedSubjects.find(a => a.subject === subj);
        if (entry) entry.classes.push(cls);
        else       assignedSubjects.push({ subject: subj, classes: [cls] });
    });

    try {
        await updateDoc(doc(db, "users", assigningTeacher.uid), { assignedSubjects });
        showNotification("Subject assignments saved.", "success");
        closeModal("modal-assign");
        await loadAllUsers();
    } catch (err) {
        console.error("Assign error:", err);
        showNotification("Could not save assignments.", "error");
    }
}

// ============================================================
//  DELETE
// ============================================================
function openDeleteModal(uid, type, message) {
    pendingDelete = { uid, type };
    document.getElementById("delete-msg").innerText = message;
    openModal("modal-delete");
}

async function confirmDelete() {
    const { uid, type } = pendingDelete;
    if (!uid) return;

    try {
        if (type === "class") {
            await deleteDoc(doc(db, "classes", uid));
            await loadClasses();
        } else {
            await deleteDoc(doc(db, "users", uid));
            await loadAllUsers();
        }
        showNotification("Record removed successfully.", "success");
        closeModal("modal-delete");
    } catch (err) {
        console.error("Delete error:", err);
        showNotification("Could not delete record.", "error");
    }
}

// ============================================================
//  PUBLISH RESULTS
// ============================================================
async function publishResults() {
    const classCode = document.getElementById("publish-class").value;
    const term      = document.getElementById("publish-term").value;
    const year      = document.getElementById("publish-year").value.trim();

    if (!classCode || !term || !year) {
        showNotification("Please fill in all fields.", "error"); return;
    }

    try {
        showNotification("Publishing results...", "info");

        const q    = query(
            collection(db, "users"),
            where("classCode",     "==", classCode),
            where("role",          "==", "student"),
            where("accountStatus", "==", "active")
        );
        const snap = await getDocs(q);

        let notified = 0;
        const promises = [];

        snap.forEach(d => {
            const student = d.data();
            promises.push(
                updateDoc(doc(db, "users", d.id), { resultsPublished: true })
            );
            if (student.email) {
                promises.push(
                    sendEmailNotification(
                        student.email,
                        `Your ${term} Results Are Ready — K_Tawiah`,
                        `Hello ${student.firstName},\n\nYour ${term} ${year} results have been published. Log in to view your report card.`,
                        db
                    )
                );
                notified++;
            }
        });

        await Promise.all(promises);

        await addDoc(collection(db, "published_reports"), {
            classCode,
            term,
            year,
            publishedBy:      currentAdmin?.uid,
            publishedAt:      serverTimestamp(),
            studentsNotified: notified
        });

        showNotification(
            `Results published! ${notified} student(s) notified.`,
            "success"
        );
        await loadResultsLog();

    } catch (err) {
        console.error("Publish error:", err);
        showNotification("Could not publish results.", "error");
    }
}

// ============================================================
//  RESULTS LOG
// ============================================================
async function loadResultsLog() {
    try {
        const snap  = await getDocs(collection(db, "published_reports"));
        const tbody = document.getElementById("results-log-tbody");

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No published results yet.</td></tr>`;
            return;
        }

        const rows = [];
        snap.forEach(d => rows.push(d.data()));
        rows.sort((a, b) => b.publishedAt?.seconds - a.publishedAt?.seconds);

        tbody.innerHTML = rows.map(r => {
            const date = r.publishedAt?.toDate
                ? r.publishedAt.toDate().toLocaleDateString() : "—";
            return `<tr>
                <td>${r.classCode || "—"}</td>
                <td>${r.term      || "—"}</td>
                <td>${r.year      || "—"}</td>
                <td>${r.publishedBy || "Admin"}</td>
                <td>${date}</td>
                <td>${r.studentsNotified || 0} students</td>
            </tr>`;
        }).join("");

    } catch (err) {
        console.error("Load results log error:", err);
    }
}

// ============================================================
//  PROFILE
// ============================================================
async function updateProfile() {
    const fname = sanitizeInput(document.getElementById("profile-firstname").value.trim());
    const lname = sanitizeInput(document.getElementById("profile-lastname").value.trim());
    const phone = sanitizeInput(document.getElementById("profile-phone").value.trim());

    if (!fname || !lname) {
        showNotification("Name fields cannot be empty.", "error"); return;
    }
    if (phone && !validatePhone(phone)) {
        showNotification("Invalid phone number format.", "error"); return;
    }

    try {
        await updateDoc(doc(db, "users", currentAdmin.uid), {
            firstName: fname, lastName: lname, phone
        });
        showNotification("Profile updated successfully.", "success");
    } catch (err) {
        console.error("Profile update error:", err);
        showNotification("Could not update profile.", "error");
    }
}

async function changePassword() {
    const current = document.getElementById("current-password").value;
    const newPass = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    if (!current || !newPass || !confirm) {
        showNotification("Please fill in all password fields.", "error"); return;
    }
    if (newPass !== confirm) {
        showNotification("New passwords do not match.", "error"); return;
    }
    if (!validatePassword(newPass)) {
        showNotification("Password must be 8+ characters.", "error"); return;
    }

    try {
        const user       = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPass);
        showNotification("Password changed successfully.", "success");
        ["current-password","new-password","confirm-password"]
            .forEach(id => document.getElementById(id).value = "");
    } catch (err) {
        console.error("Password change error:", err);
        if (err.code === "auth/wrong-password")
            showNotification("Current password is incorrect.", "error");
        else
            showNotification("Could not change password.", "error");
    }
}

// ============================================================
//  SEARCH & FILTER
// ============================================================
function filterTable(tbodyId, query) {
    document.querySelectorAll(`#${tbodyId} tr[data-search]`).forEach(row => {
        row.style.display = row.dataset.search.includes(query.toLowerCase())
            ? "" : "none";
    });
}

function filterStudentsByClass(classCode) {
    document.querySelectorAll("#student-tbody tr[data-class]").forEach(row => {
        row.style.display = (!classCode || row.dataset.class === classCode)
            ? "" : "none";
    });
}