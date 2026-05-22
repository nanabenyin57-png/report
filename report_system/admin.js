// ============================================================
//  admin.js — K_Tawiah Admin Dashboard
//  Tabs: Overview, Teachers, Students, Classes, Results, Profile
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
         query, where, orderBy,
         limit, addDoc,
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
         sendEmailNotification,
         MESSAGES }                     from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
// ── Global Department-to-Subject Mapping ───────────────────
const DEPARTMENT_SUBJECTS = {
    "Preschool": [
        "Literacy", 
        "Numeracy", 
        "Writing", 
        "Creative Arts"
    ],
    "Lower Primary": [
        "English", 
        "Mathematics", 
        "Science", 
        "Creative Arts", 
        "Twi", 
        "French", 
        "History", 
        "RME"
    ],
    "Upper Primary": [
        "English", 
        "Mathematics", 
        "Science", 
        "Creative Arts", 
        "Twi", 
        "French", 
        "History", 
        "RME", 
        "Computing"
    ],
    "Junior High": [
        "English", 
        "Mathematics", 
        "Science", 
        "Creative Arts", 
        "Twi", 
        "French", 
        "Social Studies", 
        "RME", 
        "Computing", 
        "Career Technology"
    ]
};
// ── State ──────────────────────────────────────────────────
let currentAdmin   = null;
let allClasses     = [];
let pendingDelete  = { uid: null, type: null };
let assigningTeacher = { uid: null, name: null };

// ============================================================
//  AUTH GUARD — inside DOMContentLoaded so elements exist
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "index.html"; return; }

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (!snap.exists()) { showDenied(); return; }

            const data = snap.data();
            const role = resolveRole(data.role);

            if (role !== "admin") { showDenied(); return; }

            currentAdmin = { uid: user.uid, ...data };

            // Show dashboard
            document.getElementById("dashboard").style.display     = "block";
            document.getElementById("access-denied").style.display = "none";

            const name = data.firstName || data.firstname || "Admin";
            document.getElementById("admin-welcome").innerText =
                `Welcome back, ${name}. You have full control.`;

            // Prefill profile tab
            document.getElementById("profile-firstname").value = data.firstName || "";
            document.getElementById("profile-lastname").value  = data.lastName  || "";
            document.getElementById("profile-phone").value     = data.phone     || "";

            // Load all data
            await Promise.all([
                loadClasses(),
                loadAllUsers(),
                loadResultsLog()
            ]);

        } catch (err) {
            console.error("Auth error:", err);
            showDenied();
        }
    });
});

function showDenied() {
    const dash   = document.getElementById("dashboard");
    const denied = document.getElementById("access-denied");
    if (dash)   dash.style.display   = "none";
    if (denied) denied.style.display = "block";
}

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
                <button class="btn-danger" data-class-id="${c.id}">🗑️ Remove</button>
            </div>
        </div>
    `).join("");

    // Wire delete buttons
    grid.querySelectorAll(".btn-danger[data-class-id]").forEach(btn => {
        btn.addEventListener("click", () => {
            openDeleteModal(btn.dataset.classId, "class",
                `Remove class "${btn.dataset.classId}"? Students in this class will not be deleted.`);
        });
    });
}

function populateClassDropdowns() {
    const dropdowns = [
        "ns-class", "student-class-filter",
        "publish-class"
    ];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const first = el.options[0];
        el.innerHTML = "";
        el.appendChild(first);
        allClasses.forEach(c => {
            const opt = document.createElement("option");
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
        const snap = await getDocs(collection(db, "users"));
        const students = [], teachers = [], pending = [], recent = [];

        snap.forEach(d => {
            const data = { uid: d.id, ...d.data() };
            const role = resolveRole(data.role);
            if (data.accountStatus === "pending") pending.push(data);
            else if (role === "student")          students.push(data);
            else if (role === "teacher" || role === "admin") teachers.push(data);

            // collect 5 most recent students
            if (role === "student" && data.createdAt) recent.push(data);
        });

        // Sort recent by createdAt desc
        recent.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

        // Update stats
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
                    <button class="btn-success" data-uid="${u.uid}" data-action="approve">✓ Approve</button>
                    <button class="btn-danger"  data-uid="${u.uid}" data-action="reject">✗ Reject</button>
                </div>
            </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const { uid, action } = btn.dataset;
            if (action === "approve") approveTeacher(uid);
            else rejectTeacher(uid);
        });
    });
}

function renderTeacherTable(users) {
    const tbody = document.getElementById("teacher-tbody");
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No teachers found.</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const name    = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        const role    = resolveRole(u.role);
        const status  = u.accountStatus || "active";
        const subjCount = u.assignedSubjects?.length || 0;
        return `<tr data-search="${name.toLowerCase()} ${(u.email||"").toLowerCase()}">
            <td>${name}</td>
            <td>${u.email || "—"}</td>
            <td>${u.phone || "—"}</td>
            <td>
                <span class="badge badge-${status}">${status}</span>
                ${role === "admin" ? '<span class="badge badge-admin" style="margin-left:4px">admin</span>' : ""}
            </td>
            <td>${subjCount} subject${subjCount !== 1 ? "s" : ""}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-secondary" data-uid="${u.uid}" data-name="${name}" data-action="assign">
                        📚 Assign
                    </button>
                    <button class="btn-danger" data-uid="${u.uid}" data-name="${name}" data-action="remove-teacher">
                        🗑️ Remove
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("button[data-action]").forEach(btn => {
        const { uid, name, action } = btn.dataset;
        btn.addEventListener("click", () => {
            if (action === "assign")         openAssignModal(uid, name);
            else if (action === "remove-teacher")
                openDeleteModal(uid, "teacher", `Remove teacher "${name}" from the system?`);
        });
    });
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
        return `<tr data-search="${name.toLowerCase()} ${(u.indexNo||"").toLowerCase()}"
                    data-class="${u.classCode || ""}">
            <td>${name}</td>
            <td><span style="font-family:'Cinzel',serif;font-size:0.8rem;color:var(--gold-light)">${u.indexNo || "—"}</span></td>
            <td>${u.classCode || "—"}</td>
            <td>${u.phone || "—"}</td>
            <td><span class="badge badge-${status}">${status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-danger" data-uid="${u.uid}" data-name="${name}" data-action="remove-student">
                        🗑️ Remove
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("button[data-action='remove-student']").forEach(btn => {
        btn.addEventListener("click", () => {
            openDeleteModal(btn.dataset.uid, "student",
                `Remove student "${btn.dataset.name}" from the system?`);
        });
    });
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

        // Notify teacher by email
        await sendEmailNotification(db, setDoc, doc, {
            to:      data.email,
            subject: "Your K_Tawiah Teacher Account Has Been Approved",
            text:    `Hello ${data.firstName},\n\nYour teacher account has been approved. You can now sign in at the K_Tawiah Student Report System.\n\nWelcome aboard!`,
            html:    `<h2>Account Approved! 🎉</h2>
                      <p>Hello <strong>${data.firstName}</strong>,</p>
                      <p>Your teacher account has been approved. You can now sign in.</p>
                      <p><a href="index.html">Sign In Now →</a></p>`
        });

        showNotification(`${data.firstName} has been approved as a teacher.`, "success");
        await loadAllUsers();
    } catch (err) {
        console.error("Approve error:", err);
        showNotification("Could not approve teacher. Try again.", "error");
    }
}

async function rejectTeacher(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return;
        const data = snap.data();

        await updateDoc(doc(db, "users", uid), {
            accountStatus: "suspended"
        });

        await sendEmailNotification(db, setDoc, doc, {
            to:      data.email,
            subject: "K_Tawiah Account Application Update",
            text:    `Hello ${data.firstName},\n\nUnfortunately your teacher account application has not been approved at this time. Please contact your school administrator for more information.`,
            html:    `<h2>Account Not Approved</h2>
                      <p>Hello <strong>${data.firstName}</strong>,</p>
                      <p>Your teacher account application has not been approved at this time.</p>
                      <p>Please contact your school administrator for more information.</p>`
        });

        showNotification(`${data.firstName}'s account has been rejected.`, "warning");
        await loadAllUsers();
    } catch (err) {
        console.error("Reject error:", err);
        showNotification("Could not reject teacher. Try again.", "error");
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

        // Generate index number: KT-B4A-001
        const indexNo = await generateIndexNumber(db, classCode, getDocs, collection, query, where);
        if (!indexNo) {
            showNotification("Could not generate index number. Try again.", "error"); return;
        }

        // Save to Firestore using indexNo as document ID
        await setDoc(doc(db, "users", indexNo), {
            firstName:     fname,
            lastName:      lname,
            classCode:     classCode,
            indexNo:       indexNo,
            phone:         phone || "",
            email:         email || "",
            role:          "student",
            accountStatus: "pending", // pending until student logs in and sets password
            createdBy:     currentAdmin?.uid || "admin",
            createdAt:     serverTimestamp()
        });

        // Update class student count
        const classRef = doc(db, "classes", classCode);
        const classSnap = await getDoc(classRef);
        if (classSnap.exists()) {
            const count = (classSnap.data().studentCount || 0) + 1;
            await updateDoc(classRef, { studentCount: count });
        }

        showNotification(
            `Student added! Index No: ${indexNo}. Hand credentials to student manually.`,
            "success"
        );

        // Show index number clearly
        document.getElementById("index-preview-val").innerText = indexNo;
        document.getElementById("index-preview").style.display = "block";

        // Clear form
        ["ns-firstname","ns-lastname","ns-phone","ns-email"].forEach(id => {
            document.getElementById(id).value = "";
        });
        document.getElementById("ns-class").value = "";

        await loadAllUsers();
        await loadClasses();

    } catch (err) {
        console.error("Add student error:", err);
        showNotification("Could not add student. Try again.", "error");
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
        showNotification("Class code can only contain letters and numbers.", "error"); return;
    }

    try {
        // Check if already exists
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

        showNotification(`Class "${code}" added successfully!`, "success");
        closeModal("modal-add-class");
        document.getElementById("nc-code").value = "";
        document.getElementById("nc-name").value = "";
        document.getElementById("dept-preview").innerText = "";

        await loadClasses();
    } catch (err) {
        console.error("Add class error:", err);
        showNotification("Could not add class. Try again.", "error");
    }
}

// ============================================================
//  ASSIGN SUBJECTS TO TEACHER
// ============================================================
async function openAssignModal(uid, name) {
    assigningTeacher = { uid, name };
    document.getElementById("assign-teacher-label").innerText = `Teacher: ${name}`;

    // 1. Load current assignments and teacher profile data
    const snap = await getDoc(doc(db, "users", uid));
    const teacherData = snap.data() || {};
    const current = teacherData.assignedSubjects || [];
    
    // Track teacher's target department (e.g., "Science", "Business", etc.)
    const teacherDepartment = teacherData.department; 

    // Map existing assignments for UI chip toggling
    const currentMap = {};
    current.forEach(a => { currentMap[a.subject] = a.classes || []; });

    // 2. Filter subjects based on the teacher's department
    let subjectsToRender = [];

    if (teacherDepartment && DEPARTMENT_SUBJECTS[teacherDepartment]) {
        // Teacher has a valid department -> Only pull their department's subjects
        subjectsToRender = [...DEPARTMENT_SUBJECTS[teacherDepartment]].sort();
    } else {
        // Fallback: If no department is set, gracefully display all unique subjects
        subjectsToRender = [...new Set(Object.values(DEPARTMENT_SUBJECTS).flat())].sort();
    }

    // 3. Build out the UI list with the filtered subjects
    const list = document.getElementById("assign-subjects-list");
    
    if (subjectsToRender.length === 0) {
        list.innerHTML = `<div class="form-msg error">No subjects found for department: ${teacherDepartment || "Unknown"}</div>`;
        openModal("modal-assign");
        return;
    }

    list.innerHTML = subjectsToRender.map(subj => {
        const assignedClasses = currentMap[subj] || [];
        const chips = allClasses.map(c => `
            <span class="class-chip ${assignedClasses.includes(c.id) ? "selected" : ""}"
                  data-subject="${subj}" data-class="${c.id}">
                ${c.id}
            </span>
        `).join("");

        return `
            <div class="assign-subject-row">
                <div class="assign-subject-name">
                    ${subj} 
                    ${!teacherDepartment ? `<small style="display:block;color:var(--text-muted);font-size:0.65rem;">Global</small>` : ''}
                </div>
                <div class="assign-classes-wrap">${chips}</div>
            </div>
        `;
    }).join("");

    // 4. Attach event listeners to toggle chips on click
    list.querySelectorAll(".class-chip").forEach(chip => {
        chip.addEventListener("click", () => chip.classList.toggle("selected"));
    });

    openModal("modal-assign");
}
async function saveAssignments() {
    if (!assigningTeacher.uid) return;

    // Collect all selected chips
    const assignedSubjects = [];
    const allSubjects = [...new Set(Object.values(DEPARTMENT_SUBJECTS).flat())].sort();

    allSubjects.forEach(subj => {
        const classes = [];
        document.querySelectorAll(
            `.class-chip.selected[data-subject="${subj}"]`
        ).forEach(chip => classes.push(chip.dataset.class));
        if (classes.length) assignedSubjects.push({ subject: subj, classes });
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
//  DELETE (Teacher or Student or Class)
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
        await deleteDoc(doc(db, "users", uid));
        showNotification("Record removed successfully.", "success");
        closeModal("modal-delete");

        if (type === "class") {
            await deleteDoc(doc(db, "classes", uid));
            await loadClasses();
        }
        await loadAllUsers();
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

        // Get all students in this class
        const q    = query(
            collection(db, "users"),
            where("classCode",     "==", classCode),
            where("role",          "==", "student"),
            where("accountStatus", "==", "active")
        );
        const snap = await getDocs(q);

        let notified = 0;
        snap.forEach(async (d) => {
            const student = d.data();

            // Mark their report as published
            await updateDoc(doc(db, "users", d.id), {
                resultsPublished: true
            });

            // Send email notification
            if (student.email) {
                await sendEmailNotification(db, setDoc, doc, {
                    to:      student.email,
                    subject: `Your ${term} Results Are Ready — K_Tawiah`,
                    text:    `Hello ${student.firstName},\n\nYour ${term} ${year} results have been published. Log in to view your report card.`,
                    html:    `<h2>Your Results Are Ready! 📊</h2>
                              <p>Hello <strong>${student.firstName}</strong>,</p>
                              <p>Your <strong>${term} ${year}</strong> results have been published.</p>
                              <p><a href="student.html">View Your Report Card →</a></p>`
                });
                notified++;
            }
        });

        // Log the publish event
        await addDoc(collection(db, "published_reports"), {
            classCode,
            term,
            year,
            publishedBy:  currentAdmin?.uid,
            publishedAt:  serverTimestamp(),
            studentsNotified: notified
        });

        showNotification(
            `Results published! ${notified} student(s) notified by email.`,
            "success"
        );
        await loadResultsLog();
    } catch (err) {
        console.error("Publish error:", err);
        showNotification("Could not publish results. Try again.", "error");
    }
}

// ============================================================
//  RESULTS LOG
// ============================================================
async function loadResultsLog() {
    try {
        const snap = await getDocs(collection(db, "published_reports"));
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
                <td>${r.term     || "—"}</td>
                <td>${r.year     || "—"}</td>
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
//  PROFILE UPDATE
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
    const current  = document.getElementById("current-password").value;
    const newPass  = document.getElementById("new-password").value;
    const confirm  = document.getElementById("confirm-password").value;

    if (!current || !newPass || !confirm) {
        showNotification("Please fill in all password fields.", "error"); return;
    }
    if (newPass !== confirm) {
        showNotification("New passwords do not match.", "error"); return;
    }
    if (!validatePassword(newPass)) {
        showNotification("Password must be 6+ chars with uppercase and numbers.", "error"); return;
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
            showNotification("Could not change password. Try again.", "error");
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

// ============================================================
//  MODAL HELPERS
// ============================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = "flex"; }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = "none"; }
}

// Close modal when clicking overlay background
document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
    });
});

// ============================================================
//  TAB SWITCHING
// ============================================================
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
    });
});

// ============================================================
//  WIRE UP ALL BUTTONS
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    // Nav menu
    document.getElementById("btn-menu")
        ?.addEventListener("click", () => {
            document.getElementById("navover").classList.toggle("open");
            document.getElementById("btn-menu").classList.toggle("is-active");
        });

    // Sign out
    document.getElementById("nav-signout")
        ?.addEventListener("click", async (e) => {
            e.preventDefault();
            await signOut(auth);
            window.location.href = "index.html";
        });

    // Add Student modal
    document.getElementById("btn-open-add-student")
        ?.addEventListener("click", () => openModal("modal-add-student"));
    document.getElementById("btn-cancel-add-student")
        ?.addEventListener("click", () => closeModal("modal-add-student"));
    document.getElementById("btn-confirm-add-student")
        ?.addEventListener("click", addStudent);

    // Add Class modal
    document.getElementById("btn-open-add-class")
        ?.addEventListener("click", () => openModal("modal-add-class"));
    document.getElementById("btn-cancel-add-class")
        ?.addEventListener("click", () => closeModal("modal-add-class"));
    document.getElementById("btn-confirm-add-class")
        ?.addEventListener("click", addClass);

    // Live dept preview as user types class code
    document.getElementById("nc-code")
        ?.addEventListener("input", (e) => {
            const code = e.target.value.toUpperCase();
            const dept = getDepartment(code);
            document.getElementById("dept-preview").innerText =
                code ? `Department: ${dept}` : "";
        });

    // Live index preview when class selected for new student
    document.getElementById("ns-class")
        ?.addEventListener("change", async (e) => {
            const code = e.target.value;
            if (!code) return;
            const preview = await generateIndexNumber(db, code, getDocs, collection, query, where);
            document.getElementById("index-preview-val").innerText = preview || "—";
            document.getElementById("index-preview").style.display = "block";
        });

    // Assign subjects
    document.getElementById("btn-cancel-assign")
        ?.addEventListener("click", () => closeModal("modal-assign"));
    document.getElementById("btn-confirm-assign")
        ?.addEventListener("click", saveAssignments);

    // Delete modal
    document.getElementById("btn-cancel-delete")
        ?.addEventListener("click", () => closeModal("modal-delete"));
    document.getElementById("btn-confirm-delete")
        ?.addEventListener("click", confirmDelete);

    // Publish results
    document.getElementById("btn-publish")
        ?.addEventListener("click", publishResults);

    // Search
    document.getElementById("teacher-search")
        ?.addEventListener("input", (e) => filterTable("teacher-tbody", e.target.value));
    document.getElementById("student-search")
        ?.addEventListener("input", (e) => filterTable("student-tbody", e.target.value));
    document.getElementById("student-class-filter")
        ?.addEventListener("change", (e) => filterStudentsByClass(e.target.value));

    // Profile
    document.getElementById("btn-update-profile")
        ?.addEventListener("click", updateProfile);
    document.getElementById("btn-change-password")
        ?.addEventListener("click", changePassword);
});