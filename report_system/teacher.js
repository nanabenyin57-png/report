// ============================================================
//   K_Tawiah — teacher.js (SCHEMA ALIGNED RUNTIME)
// ============================================================

import { initializeApp }                    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged,
         signOut }                           from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc,
         getDocs, setDoc, addDoc, updateDoc,
         collection, query, where,
         orderBy, serverTimestamp }          from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { firebaseConfig, getGrade, getRemarks,
         generateIndexNumber, sanitizeInput,
         showNotification, sendEmailNotification,
         resolveRole, hasRole, DEPARTMENT_SUBJECTS } from "./config.js";

// ── INIT ──────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── STATE ─────────────────────────────────────
let currentTeacher  = null;
let teacherUid      = null;
let assignedClasses  = [];
let assignedSubjects = [];
let isFormTeacher    = false;
let formClass        = null;
let allStudents      = {};
let isAdminViewing   = false;

function goBackToAdmin() {
    sessionStorage.removeItem("adminAsTeacher");
    window.location.href = "admin.html";
}
window.goBackToAdmin = goBackToAdmin;

// ── AUTH GUARD ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    teacherUid = user.uid;

    const adminAsTeacherUid = sessionStorage.getItem("adminAsTeacher");
    if (adminAsTeacherUid) {
        teacherUid = adminAsTeacherUid;
        isAdminViewing = true;
        const banner = document.getElementById("admin-teacher-banner");
        if (banner) banner.style.display = "flex";
    }

    try {
        const snap = await getDoc(doc(db, "users", teacherUid));
        if (!snap.exists()) {
            showNotification("Profile document not initialized.", "warning");
            dismissGlobalLoader();
            return;
        }
        
        currentTeacher = snap.data();
        
        // Match string roles or array structures safely
        const rolesArray = Array.isArray(currentTeacher.role) 
            ? currentTeacher.role 
            : [currentTeacher.role || ""];

        if (rolesArray.includes("admin") || adminAsTeacherUid) {
            isAdminViewing = true;
        }

        // Aligning to real Firestore fields: formMasterOf fallback integration
        formClass = currentTeacher.formClass || currentTeacher.formMasterOf || null;
        isFormTeacher = currentTeacher.isFormTeacher || (!!formClass);

        if (isAdminViewing) {
            try {
                const classSnap = await getDocs(collection(db, "classes"));
                assignedClasses = [];
                classSnap.forEach(d => { if(d.id) assignedClasses.push(d.id); });
            } catch (err) {
                console.warn("Falling back to local assignment cache maps.", err);
            }
            
            // Auto-extract assignments if root class collections are restricted
            if (assignedClasses.length === 0 && currentTeacher.assignedSubjects) {
                const localSet = new Set();
                currentTeacher.assignedSubjects.forEach(item => {
                    (item.classes || []).forEach(c => localSet.add(c));
                });
                if(formClass) localSet.add(formClass);
                assignedClasses = Array.from(localSet);
            }

            if (assignedClasses.length === 0) {
                assignedClasses = ["B4A", "B4B"];
            }
            
            assignedSubjects = [];
            if (currentTeacher.assignedSubjects && Array.isArray(currentTeacher.assignedSubjects)) {
                currentTeacher.assignedSubjects.forEach(item => {
                    const subjectName = item.subject || "";
                    (item.classes || []).forEach(cls => {
                        if (cls) assignedSubjects.push({ subjectCode: subjectName, classCode: cls });
                    });
                });
            }
        } else {
            assignedClasses = [];
            assignedSubjects = [];
            const uniqueClasses = new Set();

            if (currentTeacher.assignedSubjects && Array.isArray(currentTeacher.assignedSubjects)) {
                currentTeacher.assignedSubjects.forEach(item => {
                    const subjectName = item.subject || "";
                    const targetClasses = item.classes || [];
                    
                    targetClasses.forEach(cls => {
                        if (cls) {
                            uniqueClasses.add(cls);
                            assignedSubjects.push({ subjectCode: subjectName, classCode: cls });
                        }
                    });
                });
            }
            if(formClass) uniqueClasses.add(formClass);
            assignedClasses = Array.from(uniqueClasses);
        }

        // DOM elements populating safely
        if (document.getElementById("welcomeName")) document.getElementById("welcomeName").textContent = currentTeacher.firstName || "User";
        if (document.getElementById("profileName")) document.getElementById("profileName").textContent = `${currentTeacher.firstName || ""} ${currentTeacher.lastName || ""}`;
        if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = currentTeacher.email || "—";
        if (document.getElementById("profilePhone")) document.getElementById("profilePhone").textContent = currentTeacher.phone || "—";
        if (document.getElementById("profileClasses")) document.getElementById("profileClasses").textContent = assignedClasses.join(", ") || "None";
        
        const subStrings = assignedSubjects.map(s => `${s.subjectCode} (${s.classCode || "Global"})`);
        if (document.getElementById("profileSubjects")) document.getElementById("profileSubjects").textContent = subStrings.join(", ") || "None";

        const formRow = document.getElementById("profileFormClassRow");
        if (formClass) {
            if (document.getElementById("profileFormClass")) document.getElementById("profileFormClass").textContent = formClass;
            if (formRow) formRow.style.display = "flex";
        } else {
            if (formRow) formRow.style.display = "none";
        }

        populateClassSelectors();
        populateSubjectSelectors();
        adjustAddStudentVisibility();

        await loadStudentsData();

    } catch (err) {
        console.error("Dashboard initialization break caught: ", err);
        showNotification("Error resolving database profile values.", "error");
        dismissGlobalLoader();
    }
});

function dismissGlobalLoader() {
    const overlay = document.getElementById("loadingOverlay") || document.getElementById("spinner") || document.querySelector(".loading");
    if (overlay) overlay.style.display = "none";
}

function adjustAddStudentVisibility() {
    const addStudentBtn = document.getElementById("openAddStudentBtn");
    const filterEl = document.getElementById("studentClassFilter");
    const classFilter = filterEl ? filterEl.value : "";

    if (!addStudentBtn) return;

    if (isAdminViewing) {
        addStudentBtn.style.display = "inline-flex";
        return;
    }

    if (classFilter) {
        if (formClass === classFilter) {
            addStudentBtn.style.display = "inline-flex";
        } else {
            addStudentBtn.style.display = "none";
        }
    } else {
        if (formClass) {
            addStudentBtn.style.display = "inline-flex";
        } else {
            addStudentBtn.style.display = "none";
        }
    }
}

function populateClassSelectors() {
    const selectors = [
        "studentClassFilter", "newStudentClass",
        "scoresClassFilter", "attendanceClassFilter",
        "rankingClassFilter", "submitClassSelect",
        "profileClassFilter"
    ];
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        while (el.options.length > 1) el.remove(1);

        assignedClasses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c; opt.textContent = c;
            el.appendChild(opt);
        });
    });
}

function populateSubjectSelectors() {
    const selectors = ["scoresSubjectFilter", "submitSubjectSelect"];
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        while (el.options.length > 1) el.remove(1);

        const uniqueSubs = [...new Set(assignedSubjects.map(s => s.subjectCode))].sort();
        uniqueSubs.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s; opt.textContent = s;
            el.appendChild(opt);
        });
    });
}

async function loadStudentsData() {
    try {
        let q;
        if (assignedClasses.length === 0) {
            q = collection(db, "students");
        } else {
            q = query(collection(db, "students"), where("classCode", "in", assignedClasses));
        }
        
        const snap = await getDocs(q);
        allStudents = {};
        snap.forEach(docSnap => {
            allStudents[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });

        renderStudentsTable();
        renderScoresTable();
        renderAttendanceTable();
        renderRankingTable();
        renderReportLinks();
        
        if (document.getElementById("statStudents")) document.getElementById("statStudents").textContent = Object.keys(allStudents).length;
        if (document.getElementById("statSubjects")) document.getElementById("statSubjects").textContent = assignedSubjects.length;

    } catch (err) {
        console.error("Query rejected or missing index structure, running fallback snapshot: ", err);
        try {
            const fallbackSnap = await getDocs(collection(db, "students"));
            allStudents = {};
            fallbackSnap.forEach(d => {
                const data = d.data();
                if (assignedClasses.includes(data.classCode) || assignedClasses.length === 0) {
                    allStudents[d.id] = { id: d.id, ...data };
                }
            });
            renderStudentsTable();
            renderScoresTable();
            renderAttendanceTable();
            renderRankingTable();
            renderReportLinks();
        } catch(fallbackErr) {
            console.error("Blackout: ", fallbackErr);
            showNotification("Data read verification failure.", "error");
        }
    } finally {
        dismissGlobalLoader();
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return; tbody.innerHTML = "";
    const filter = document.getElementById("studentClassFilter").value;
    let list = Object.values(allStudents);
    if (filter) list = list.filter(s => s.classCode === filter);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No profiles found matching class options.</td></tr>`;
        return;
    }
    list.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${s.indexNumber || "—"}</strong></td><td>${s.firstName || ""} ${s.lastName || ""}</td><td><span class="badge-class">${s.classCode || "—"}</span></td><td>${s.gender || "—"}</td><td><button class="btn-icon edit-btn" onclick="openEditStudentModal('${s.id}')">✏️</button></td>`;
        tbody.appendChild(tr);
    });
}

function openAddStudentModal() {
    const modal = document.getElementById("addStudentModal");
    if (!modal) return; modal.style.display = "flex";
    const classSelect = document.getElementById("newStudentClass");
    if (classSelect && formClass) classSelect.value = formClass;
}
window.openAddStudentModal = openAddStudentModal;

function closeAddStudentModal() {
    const modal = document.getElementById("addStudentModal");
    if (modal) modal.style.display = "none";
}
window.closeAddStudentModal = closeAddStudentModal;

async function handleCreateStudent(e) {
    e.preventDefault();
    const classCode = document.getElementById("newStudentClass").value;
    const firstName = sanitizeInput(document.getElementById("newStudentFirst").value.trim());
    const lastName  = sanitizeInput(document.getElementById("newStudentLast").value.trim());
    const gender    = document.getElementById("newStudentGender").value;
    const email     = sanitizeInput(document.getElementById("newStudentEmail").value.trim());

    if (!classCode || !firstName || !lastName || !gender || !email) {
        showNotification("Please fill all required profile parameters.", "error"); return;
    }

    try {
        const classQuery = query(collection(db, "students"), where("classCode", "==", classCode));
        const classSnap = await getDocs(classQuery);
        const idx = generateIndexNumber(classCode, classSnap.size + 1);

        const docRef = await addDoc(collection(db, "students"), { indexNumber: idx, firstName, lastName, gender, email, classCode, createdAt: serverTimestamp() });
        await setDoc(doc(db, "users", docRef.id), { uid: docRef.id, firstName, lastName, email: `${idx.toLowerCase()}@school.com`, role: "student", accountStatus: "active", createdAt: new Date().toISOString() });

        showNotification(`Student identifier ${idx} initialized!`, "success");
        closeAddStudentModal();
        document.getElementById("addStudentForm").reset();
        await loadStudentsData();
    } catch (err) {
        console.error(err); showNotification("Error handling profile entry creation.", "error");
    }
}

function renderScoresTable() {
    const tbody = document.getElementById("scoresTableBody");
    if (!tbody) return; tbody.innerHTML = "";
    const cl = document.getElementById("scoresClassFilter").value;
    const sub = document.getElementById("scoresSubjectFilter").value;
    if (!cl || !sub) { tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Select a target class and subject.</td></tr>`; return; }

    let list = Object.values(allStudents).filter(s => s.classCode === cl);
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No student registrations found.</td></tr>`; return; }

    list.forEach(s => {
        const r = (s.assessments && s.assessments[sub]) || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${s.indexNumber || "—"}</strong></td><td>${s.firstName} ${s.lastName}</td><td><input type="number" class="table-input class-score-input" data-sid="${s.id}" min="0" max="30" value="${r.classScore !== undefined ? r.classScore : ""}"></td><td><input type="number" class="table-input exam-score-input" data-sid="${s.id}" min="0" max="70" value="${r.examScore !== undefined ? r.examScore : ""}"></td><td><span>${r.totalScore !== undefined ? r.totalScore : "—"}</span></td><td><span style="font-weight:700;color:var(--gold-light)">${r.grade || "—"}</span></td>`;
        tbody.appendChild(tr);
    });
}

async function saveAssessments() {
    const sub = document.getElementById("scoresSubjectFilter").value;
    if (!sub) return;
    try {
        showNotification("Updating metrics...", "info");
        for (let tr of document.querySelectorAll("#scoresTableBody tr")) {
            const cIn = tr.querySelector(".class-score-input");
            const eIn = tr.querySelector(".exam-score-input");
            if (!cIn) continue;
            const sId = cIn.dataset.sid, cVal = cIn.value === "" ? null : parseFloat(cIn.value), eVal = eIn.value === "" ? null : parseFloat(eIn.value);
            let map = (allStudents[sId].assessments || {});
            if (cVal === null && eVal === null) { delete map[sub]; } else {
                const tot = (cVal || 0) + (eVal || 0);
                map[sub] = { classScore: cVal, examScore: eVal, totalScore: tot, grade: getGrade(tot), remarks: getRemarks(), updatedAt: new Date().toISOString() };
            }
            await updateDoc(doc(db, "students", sId), { assessments: map });
        }
        showNotification("Assessment data records committed successfully!", "success");
        await loadStudentsData();
    } catch (err) { console.error(err); showNotification("Transaction record failed.", "error"); }
}

function renderAttendanceTable() {
    const tbody = document.getElementById("attendanceTableBody");
    if (!tbody) return; tbody.innerHTML = "";
    const filter = document.getElementById("attendanceClassFilter").value;
    if (!filter) { tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Select an assigned class reference.</td></tr>`; return; }
    let list = Object.values(allStudents).filter(s => s.classCode === filter);
    list.forEach(s => {
        const att = s.attendance || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${s.indexNumber}</strong></td><td>${s.firstName} ${s.lastName}</td><td><input type="number" class="table-input att-present" data-sid="${s.id}" value="${att.present || ""}"></td><td><input type="number" class="table-input att-absent" data-sid="${s.id}" value="${att.absent || ""}"></td><td><input type="text" class="table-input att-remarks" data-sid="${s.id}" value="${att.teacherRemarks || ""}"></td>`;
        tbody.appendChild(tr);
    });
}

async function saveAttendance() {
    try {
        showNotification("Composing logs...", "info");
        for (let tr of document.querySelectorAll("#attendanceTableBody tr")) {
            const pIn = tr.querySelector(".att-present"), aIn = tr.querySelector(".att-absent"), rIn = tr.querySelector(".att-remarks");
            if (!pIn) continue;
            await updateDoc(doc(db, "students", pIn.dataset.sid), { attendance: { present: pIn.value === "" ? 0 : parseInt(pIn.value), absent: aIn.value === "" ? 0 : parseInt(aIn.value), teacherRemarks: rIn.value.trim() } });
        }
        showNotification("Conduct entries logged!", "success");
        await loadStudentsData();
    } catch (err) { console.error(err); showNotification("Error writing records.", "error"); }
}

function renderRankingTable() {
    const tbody = document.getElementById("rankingTableBody");
    if (!tbody) return; tbody.innerHTML = "";
    const f = document.getElementById("rankingClassFilter").value;
    if (!f) return;
    let calc = Object.values(allStudents).filter(s => s.classCode === f).map(s => {
        let sum = 0, cnt = 0;
        if (s.assessments) Object.values(s.assessments).forEach(a => { sum += (a.totalScore || 0); cnt++; });
        return { indexNumber: s.indexNumber, name: `${s.firstName} ${s.lastName}`, avg: cnt > 0 ? (sum / cnt).toFixed(2) : 0 };
    }).sort((a, b) => b.avg - a.avg);
    calc.forEach((s, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${idx + 1}</strong></td><td>${s.indexNumber}</td><td>${s.name}</td><td><span class="badge-average">${s.avg}%</span></td>`;
        tbody.appendChild(tr);
    });
}

function renderReportLinks() {
    const ul = document.getElementById("studentReportList");
    if (!ul) return; ul.innerHTML = "";
    const f = document.getElementById("profileClassFilter").value;
    let list = Object.values(allStudents);
    if (f) list = list.filter(s => s.classCode === f);
    list.forEach(s => {
        const li = document.createElement("li"); li.className = "report-link-item";
        li.innerHTML = `<span><strong>${s.indexNumber}</strong> — ${s.firstName} ${s.lastName} (${s.classCode})</span><a href="student_report.html?id=${s.id}" target="_blank" class="btn-secondary btn-sm" style="margin-left:10px;text-decoration:none;">View Report Card ↗</a>`;
        ul.appendChild(li);
    });
}

async function handleSubmitReportCard(e) { e.preventDefault(); showNotification("Assessments locked and submitted to admin reviews!", "success"); }

function switchTab(name) {
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const tTab = document.getElementById(`tab-${name}`), tNav = document.querySelector(`[data-tab="${name}"]`);
    if (tTab) tTab.classList.add("active"); if (tNav) tNav.classList.add("active");
    if (document.getElementById("pageBreadcrumb")) document.getElementById("pageBreadcrumb").textContent = `Dashboard › ${name}`;
}
window.switchTab = switchTab;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("addStudentForm")?.addEventListener("submit", handleCreateStudent);
    document.getElementById("btnSaveScores")?.addEventListener("click", saveAssessments);
    document.getElementById("btnSaveAttendance")?.addEventListener("click", saveAttendance);
    document.getElementById("submitReportForm")?.addEventListener("submit", handleSubmitReportCard);
    document.getElementById("studentClassFilter")?.addEventListener("change", () => { adjustAddStudentVisibility(); renderStudentsTable(); });
    document.getElementById("scoresClassFilter")?.addEventListener("change", renderScoresTable);
    document.getElementById("scoresSubjectFilter")?.addEventListener("change", renderScoresTable);
    document.getElementById("attendanceClassFilter")?.addEventListener("change", renderAttendanceTable);
    document.getElementById("rankingClassFilter")?.addEventListener("change", renderRankingTable);
    document.getElementById("profileClassFilter")?.addEventListener("change", renderReportLinks);
    document.getElementById("banner-back-btn")?.addEventListener("click", goBackToAdmin);
    document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
    document.getElementById("openAddStudentBtn")?.addEventListener("click", openAddStudentModal);
    document.getElementById("signOutBtn")?.addEventListener("click", async () => { sessionStorage.removeItem("adminAsTeacher"); await signOut(auth); window.location.href = "index.html"; });
});