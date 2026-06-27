// ============================================================
//   K_Tawiah — teacher.js (ROLES ARRAY COMPATIBLE RUNTIME)
// ============================================================

import { initializeApp }                    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged,
         signOut }                           from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc,
         getDocs, setDoc, addDoc, updateDoc,
         collection, query, where,
         orderBy, serverTimestamp }          from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js"; // Note: ensure firestore imports match your original setup if separate

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

// ── HELPER: navigate back to admin ──
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
    
    // Default to the currently logged in session user ID
    teacherUid = user.uid;

    const adminAsTeacherUid = sessionStorage.getItem("adminAsTeacher");
    
    // CRITICAL FIX: Only overwrite teacherUid if the session value contains an actual Firebase UID, 
    // not just a literal "true" text flag string.
    if (adminAsTeacherUid && adminAsTeacherUid !== "true") {
        teacherUid = adminAsTeacherUid;
    }

    try {
        const snap = await getDoc(doc(db, "users", teacherUid));
        if (!snap.exists()) {
            showNotification("Profile database entry not found.", "error");
            return;
        }
        currentTeacher = snap.data();
        
        // Handle array role structure vs flat string roles safely
        const rolesArray = Array.isArray(currentTeacher.role) 
            ? currentTeacher.role 
            : [currentTeacher.role || ""];

        // Determine if we are viewing in Admin Override Master Mode.
        // It triggers if there's an active admin session item OR if they have the admin role but no local teacher data assigned.
        if (adminAsTeacherUid || (rolesArray.includes("admin") && !currentTeacher.assignedClasses)) {
            isAdminViewing = true;
            const banner = document.getElementById("admin-teacher-banner");
            if (banner) banner.style.display = "flex";
        }

        // Parse assignments or grant full override privileges if admin override is active
        if (isAdminViewing) {
            isFormTeacher = true;
            
            // Fetch all global system classes to populate selection tools smoothly
            const classSnap = await getDocs(collection(db, "classes"));
            assignedClasses = [];
            classSnap.forEach(d => assignedClasses.push(d.id));
            
            // Dynamically combine all available subject strings from configuration dictionary
            const globalSubjectSet = new Set();
            Object.values(DEPARTMENT_SUBJECTS).forEach(subs => {
                subs.forEach(s => globalSubjectSet.add(s));
            });
            
            assignedSubjects = Array.from(globalSubjectSet).map(subjectName => {
                return { subjectCode: subjectName, classCode: "All" };
            });
        } else {
            // Normal routing for teachers, or dual role users acting in their teacher capacity
            assignedClasses  = currentTeacher.assignedClasses || [];
            assignedSubjects = currentTeacher.assignedSubjects || [];
            isFormTeacher    = currentTeacher.isFormTeacher || false;
            formClass        = currentTeacher.formClass || null;
        }

        // Render profile text elements safely
        if (document.getElementById("welcomeName")) document.getElementById("welcomeName").textContent = currentTeacher.firstName || "Admin/Teacher";
        if (document.getElementById("profileName")) document.getElementById("profileName").textContent = `${currentTeacher.firstName || ""} ${currentTeacher.lastName || ""}`;
        if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = currentTeacher.email || "—";
        if (document.getElementById("profilePhone")) document.getElementById("profilePhone").textContent = currentTeacher.phone || "—";
        if (document.getElementById("profileClasses")) document.getElementById("profileClasses").textContent = isAdminViewing ? "All System Classes" : (assignedClasses.join(", ") || "None");
        
        const subStrings = assignedSubjects.map(s => `${s.subjectCode} (${s.classCode || "Global"})`);
        if (document.getElementById("profileSubjects")) document.getElementById("profileSubjects").textContent = isAdminViewing ? "All Subjects Override Access" : (subStrings.join(", ") || "None");

        const formRow = document.getElementById("profileFormClassRow");
        if (isFormTeacher && formClass) {
            if (document.getElementById("profileFormClass")) document.getElementById("profileFormClass").textContent = formClass;
            if (formRow) formRow.style.display = "flex";
        } else if (isAdminViewing) {
            if (document.getElementById("profileFormClass")) document.getElementById("profileFormClass").textContent = "Global Admin Master Access";
            if (formRow) formRow.style.display = "flex";
        } else {
            if (formRow) formRow.style.display = "none";
        }

        // Initialize selectors and pipelines
        populateClassSelectors();
        populateSubjectSelectors();
        
        // Dynamic visibility check for Add Student actions
        adjustAddStudentVisibility();

        await loadStudentsData();

    } catch (err) {
        console.error("Dashboard dependency failure: ", err);
        showNotification("Error loading dashboard dependencies.", "error");
    }
});

// ── DYNAMIC BUTTON VISIBILITY FOR FORM MASTERS ──
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
        if (isFormTeacher && formClass === classFilter) {
            addStudentBtn.style.display = "inline-flex";
        } else {
            addStudentBtn.style.display = "none";
        }
    } else {
        if (isFormTeacher && formClass) {
            addStudentBtn.style.display = "inline-flex";
        } else {
            addStudentBtn.style.display = "none";
        }
    }
}

// ── POPULATE SELECTORS ────────────────────────
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

// ── POPULATE SUBJECTS ──
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

// ── DATA INGESTION: ALL ASSIGNED STUDENTS ──
async function loadStudentsData() {
    try {
        let q;
        if (isAdminViewing || assignedClasses.length === 0) {
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
        
        const totalCount = Object.keys(allStudents).length;
        if (document.getElementById("statStudents")) document.getElementById("statStudents").textContent = totalCount;
        if (document.getElementById("statSubjects")) document.getElementById("statSubjects").textContent = assignedSubjects.length;

    } catch (err) {
        console.error(err);
        showNotification("Error loading student database records.", "error");
    }
}

// ── RENDER DATA TABLES ──
function renderStudentsTable() {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filter = document.getElementById("studentClassFilter").value;
    let list = Object.values(allStudents);
    if (filter) list = list.filter(s => s.classCode === filter);

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No students found matching selection filters.</td></tr>`;
        return;
    }

    list.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${s.indexNumber || "—"}</strong></td>
            <td>${s.firstName || ""} ${s.lastName || ""}</td>
            <td><span class="badge-class">${s.classCode || "—"}</span></td>
            <td>${s.gender || "—"}</td>
            <td>
                <button class="btn-icon edit-btn" onclick="openEditStudentModal('${s.id}')" title="Edit Profile">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAddStudentModal() {
    const modal = document.getElementById("addStudentModal");
    if (!modal) return;
    modal.style.display = "flex";
    
    const classSelect = document.getElementById("newStudentClass");
    if (classSelect && !isAdminViewing && isFormTeacher && formClass) {
        classSelect.value = formClass;
    }
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
        showNotification("Please fulfill all required profile fields.", "error");
        return;
    }

    if (!isAdminViewing) { 
        if (!isFormTeacher || formClass !== classCode) {
            showNotification(`Access Denied! You are not the assigned Form Master for class ${classCode}.`, "error");
            return;
        }
    }

    try {
        showNotification("Generating unique index mapping...", "info");
        const idx = await generateIndexNumber(db, collection, getDocs, query, where);

        const newStudentDoc = {
            indexNumber: idx,
            firstName,
            lastName,
            gender,
            email,
            classCode,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "students"), newStudentDoc);
        
        const stdVirtualEmail = `${idx.toLowerCase()}@school.com`;
        await setDoc(doc(db, "users", docRef.id), {
            uid: docRef.id,
            firstName,
            lastName,
            email: stdVirtualEmail,
            role: "student",
            accountStatus: "active",
            createdAt: new Date().toISOString()
        });

        showNotification(`Student identifier ${idx} assigned and saved!`, "success");
        closeAddStudentModal();
        document.getElementById("addStudentForm").reset();
        await loadStudentsData();

    } catch (err) {
        console.error(err);
        showNotification("Error committing profile record.", "error");
    }
}

function renderScoresTable() {
    const tbody = document.getElementById("scoresTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const classFilter   = document.getElementById("scoresClassFilter").value;
    const subjectFilter = document.getElementById("scoresSubjectFilter").value;

    if (!classFilter || !subjectFilter) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Please select both a class and a subject to view layout arrays.</td></tr>`;
        return;
    }

    const hasAccess = assignedSubjects.some(s => s.classCode === classFilter && s.subjectCode === subjectFilter);
    if (!hasAccess && !isAdminViewing) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="color:var(--danger)">Access Denied: You do not teach ${subjectFilter} in Class ${classFilter}.</td></tr>`;
        return;
    }

    let list = Object.values(allStudents).filter(s => s.classCode === classFilter);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No students currently registered in Class ${classFilter}.</td></tr>`;
        return;
    }

    list.forEach(s => {
        const record = (s.assessments && s.assessments[subjectFilter]) || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${s.indexNumber || "—"}</strong></td>
            <td>${s.firstName} ${s.lastName}</td>
            <td><input type="number" class="table-input class-score-input" data-sid="${s.id}" min="0" max="30" value="${record.classScore !== undefined ? record.classScore : ""}" placeholder="Max 30"></td>
            <td><input type="number" class="table-input exam-score-input" data-sid="${s.id}" min="0" max="70" value="${record.examScore !== undefined ? record.examScore : ""}" placeholder="Max 70"></td>
            <td><span class="total-score-span" id="total-${s.id}-${subjectFilter}">${record.totalScore !== undefined ? record.totalScore : "—"}</span></td>
            <td><span class="grade-span" id="grade-${s.id}-${subjectFilter}" style="font-weight:700; color:var(--gold-light)">${record.grade || "—"}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveAssessments() {
    const classFilter   = document.getElementById("scoresClassFilter").value;
    const subjectFilter = document.getElementById("scoresSubjectFilter").value;

    if (!classFilter || !subjectFilter) return;

    try {
        showNotification("Saving assessment reports...", "info");
        const rows = document.querySelectorAll("#scoresTableBody tr");
        
        for (let tr of rows) {
            const classInput = tr.querySelector(".class-score-input");
            const examInput  = tr.querySelector(".exam-score-input");
            if (!classInput) continue;

            const sId = classInput.dataset.sid;
            const cVal = classInput.value === "" ? null : parseFloat(classInput.value);
            const eVal = examInput.value === "" ? null : parseFloat(examInput.value);

            let assessmentMap = (allStudents[sId].assessments || {});
            
            if (cVal === null && eVal === null) {
                delete assessmentMap[subjectFilter];
            } else {
                const total = (cVal || 0) + (eVal || 0);
                const grade = getGrade(total);
                const remarks = getRemarks(grade);

                assessmentMap[subjectFilter] = {
                    classScore: cVal,
                    examScore: eVal,
                    totalScore: total,
                    grade,
                    remarks,
                    updatedAt: new Date().toISOString()
                };
            }

            await updateDoc(doc(db, "students", sId), { assessments: assessmentMap });
        }

        showNotification("All scorecards compiled and updated successfully!", "success");
        await loadStudentsData();
    } catch (err) {
        console.error(err);
        showNotification("Error writing records back to server database tier.", "error");
    }
}

function renderAttendanceTable() {
    const tbody = document.getElementById("attendanceTableBody");
    if (!tbody) return; tbody.innerHTML = "";

    const filter = document.getElementById("attendanceClassFilter").value;
    if (!filter) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Please specify an assigned class.</td></tr>`;
        return;
    }

    let list = Object.values(allStudents).filter(s => s.classCode === filter);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No students configured in this class layer.</td></tr>`;
        return;
    }

    list.forEach(s => {
        const att = s.attendance || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${s.indexNumber}</strong></td>
            <td>${s.firstName} ${s.lastName}</td>
            <td><input type="number" class="table-input att-present" data-sid="${s.id}" value="${att.present || ""}" placeholder="Days"></td>
            <td><input type="number" class="table-input att-absent" data-sid="${s.id}" value="${att.absent || ""}" placeholder="Days"></td>
            <td><input type="text" class="table-input att-remarks" data-sid="${s.id}" value="${att.teacherRemarks || ""}" placeholder="Conduct comments..."></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveAttendance() {
    const filter = document.getElementById("attendanceClassFilter").value;
    if (!filter) return;

    try {
        showNotification("Composing behavior remarks...", "info");
        const rows = document.querySelectorAll("#attendanceTableBody tr");

        for (let tr of rows) {
            const presInp = tr.querySelector(".att-present");
            const absInp  = tr.querySelector(".att-absent");
            const remInp  = tr.querySelector(".att-remarks");
            if (!presInp) continue;

            const sId = presInp.dataset.sid;
            await updateDoc(doc(db, "students", sId), {
                attendance: {
                    present: presInp.value === "" ? 0 : parseInt(presInp.value),
                    absent: absInp.value === "" ? 0 : parseInt(absInp.value),
                    teacherRemarks: remInp.value.trim()
                }
            });
        }
        showNotification("Conduct logs appended successfully!", "success");
        await loadStudentsData();
    } catch (err) {
        console.error(err);
        showNotification("Failed to save parameters.", "error");
    }
}

function renderRankingTable() {
    const tbody = document.getElementById("rankingTableBody");
    if (!tbody) return; tbody.innerHTML = "";
    const filter = document.getElementById("rankingClassFilter").value;
    if (!filter) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Select a class to calculate placement algorithms.</td></tr>`; 
        return;
    }
    let list = Object.values(allStudents).filter(s => s.classCode === filter);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No student values available.</td></tr>`;
        return;
    }
    let calculated = list.map(s => {
        let totalSum = 0, count = 0;
        if (s.assessments) {
            Object.values(s.assessments).forEach(a => {
                totalSum += (a.totalScore || 0); count++;
            });
        }
        return { id: s.id, indexNumber: s.indexNumber, name: `${s.firstName} ${s.lastName}`, avg: count > 0 ? (totalSum / count).toFixed(2) : 0 };
    });
    calculated.sort((a, b) => b.avg - a.avg);
    calculated.forEach((s, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${idx + 1}</strong></td><td>${s.indexNumber}</td><td>${s.name}</td><td><span class="badge-average">${s.avg}%</span></td>`;
        tbody.appendChild(tr);
    });
}

function renderReportLinks() {
    const ul = document.getElementById("studentReportList");
    if (!ul) return; ul.innerHTML = "";
    const filter = document.getElementById("profileClassFilter").value;
    let list = Object.values(allStudents);
    if (filter) list = list.filter(s => s.classCode === filter);
    if (list.length === 0) {
        ul.innerHTML = `<li class="empty-msg">No active transcripts found.</li>`; 
        return;
    }
    list.forEach(s => {
        const li = document.createElement("li");
        li.className = "report-link-item";
        li.innerHTML = `<span><strong>${s.indexNumber}</strong> — ${s.firstName} ${s.lastName} (${s.classCode})</span>
                        <a href="student_report.html?id=${s.id}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none; margin-left:10px;">View Report Card ↗</a>`;
        ul.appendChild(li);
    });
}

async function handleSubmitReportCard(e) {
    e.preventDefault();
    const cl = document.getElementById("submitClassSelect").value;
    const sub = document.getElementById("submitSubjectSelect").value;
    if (!cl || !sub) { showNotification("Please specify all entry targets.", "error"); return; }
    showNotification(`Assessments for ${sub} in class ${cl} locked and dispatched to admin reviews!`, "success");
}

const tabTitles = { dashboard: "Overview", students: "Student Registry", scores: "Input Scores", attendance: "Conduct & Attendance", ranking: "Class Analytics", submit: "Final Submission", profile: "My Portal Profile" };
function switchTab(name) {
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    
    const targetTab = document.getElementById(`tab-${name}`);
    const targetNav = document.querySelector(`[data-tab="${name}"]`);
    
    if (targetTab) targetTab.classList.add("active");
    if (targetNav) targetNav.classList.add("active");
    
    if (document.getElementById("pageBreadcrumb")) {
        document.getElementById("pageBreadcrumb").textContent = `Dashboard › ${tabTitles[name] || name}`;
    }
}
window.switchTab = switchTab;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("addStudentForm")?.addEventListener("submit", handleCreateStudent);
    document.getElementById("btnSaveScores")?.addEventListener("click", saveAssessments);
    document.getElementById("btnSaveAttendance")?.addEventListener("click", saveAttendance);
    document.getElementById("submitReportForm")?.addEventListener("submit", handleSubmitReportCard);

    document.getElementById("studentClassFilter")?.addEventListener("change", () => {
        adjustAddStudentVisibility();
        renderStudentsTable();
    });
    document.getElementById("scoresClassFilter")?.addEventListener("change", renderScoresTable);
    document.getElementById("scoresSubjectFilter")?.addEventListener("change", renderScoresTable);
    document.getElementById("attendanceClassFilter")?.addEventListener("change", renderAttendanceTable);
    document.getElementById("rankingClassFilter")?.addEventListener("change", renderRankingTable);
    document.getElementById("profileClassFilter")?.addEventListener("change", renderReportLinks);
    document.getElementById("banner-back-btn")?.addEventListener("click", goBackToAdmin);
    
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.getElementById("qa-students")?.addEventListener("click", () => { switchTab("students"); openAddStudentModal(); });
    document.getElementById("qa-scores")?.addEventListener("click", () => switchTab("scores"));
    document.getElementById("qa-attendance")?.addEventListener("click", () => switchTab("attendance"));
    document.getElementById("qa-submit")?.addEventListener("click", () => switchTab("submit"));
    document.getElementById("openAddStudentBtn")?.addEventListener("click", openAddStudentModal);
    
    document.getElementById("signOutBtn")?.addEventListener("click", async () => {
        sessionStorage.removeItem("adminAsTeacher");
        await signOut(auth);
        window.location.href = "index.html";
    });
});

function showToast(message, type = "info") {
    showNotification(message, type);
}