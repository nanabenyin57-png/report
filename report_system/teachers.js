// =============================================
//   K_Tawiah — teacher.js
//   Teacher Dashboard Logic (ES Module)
// =============================================

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
         resolveRole }                       from "./config.js";

// ── INIT ──────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── STATE ─────────────────────────────────────
let currentTeacher = null;   // Firestore teacher doc data
let teacherUid     = null;
let assignedClasses   = [];  // class codes assigned to this teacher
let assignedSubjects  = [];  // subjects assigned (array of {classCode, subject})
let isFormTeacher     = false;
let formClass         = null; // class code if form teacher
let allStudents       = {};  // { classCode: [studentDocs] }

// ── AUTH GUARD ────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "index.html"; return; }
  teacherUid = user.uid;
  await loadTeacherProfile(user);
});

// ── LOAD TEACHER PROFILE ──────────────────────
async function loadTeacherProfile(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { showToast("Teacher profile not found.", "error"); return; }

    const data = snap.data();
    const role = resolveRole(data.role);

    // Only teachers get access
    if (!["teacher", "staff"].includes(role) && role !== "admin") {
      window.location.href = "index.html"; return;
    }

    currentTeacher   = { id: snap.id, ...data };
    assignedClasses  = data.assignedClasses  || [];
    assignedSubjects = data.assignedSubjects || [];  // [{ classCode, subject }]
    isFormTeacher    = !!(data.formClass);
    formClass        = data.formClass || null;

    // Populate sidebar
    const initials = (data.displayName || data.name || "T").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
    document.getElementById("sidebarAvatar").textContent  = initials;
    document.getElementById("profileAvatarLarge").textContent = initials;
    document.getElementById("sidebarName").textContent    = data.displayName || data.name || "Teacher";
    document.getElementById("sidebarRole").textContent    = isFormTeacher ? "Form Teacher" : "Teacher";
    document.getElementById("termValue").textContent      = data.currentTerm || "—";

    // Show/hide ranking nav
    document.getElementById("rankingNavBtn").classList.toggle("hidden", !isFormTeacher);

    // Populate profile tab
    document.getElementById("profileName").textContent     = data.displayName || data.name || "—";
    document.getElementById("profileEmail").textContent    = data.email || "—";
    document.getElementById("profilePhone").textContent    = data.phone || "—";
    document.getElementById("profileRole").textContent     = isFormTeacher ? "Form Teacher" : "Teacher";
    document.getElementById("profileClasses").textContent  = assignedClasses.join(", ") || "None";
    document.getElementById("profileSubjects").textContent = assignedSubjects.map(s => `${s.subject} (${s.classCode})`).join(", ") || "None";

    if (isFormTeacher) {
      document.getElementById("profileFormClass").textContent = formClass;
    } else {
      document.getElementById("profileFormClassRow").style.display = "none";
    }

    await populateClassSelectors();
    await loadOverview();
    await loadProfileStudents();

  } catch (err) {
    console.error(err);
    showToast("Failed to load profile.", "error");
  }
}

// ── POPULATE CLASS SELECTORS ──────────────────
async function populateClassSelectors() {
  const selectors = [
    "studentClassFilter", "newStudentClass",
    "scoresClassFilter", "attendanceClassFilter",
    "rankingClassFilter", "submitClassSelect",
    "profileClassFilter"
  ];
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Keep first placeholder option
    while (el.options.length > 1) el.remove(1);
    assignedClasses.forEach(code => {
      const opt = document.createElement("option");
      opt.value = code; opt.textContent = code;
      el.appendChild(opt);
    });
  });

  // Profile class filter: add "All"
  const pcf = document.getElementById("profileClassFilter");
  if (pcf && pcf.options.length === 0) {
    const all = document.createElement("option");
    all.value = ""; all.textContent = "All Classes";
    pcf.prepend(all);
  }
}

// ── LOAD OVERVIEW ─────────────────────────────
async function loadOverview() {
  // Assigned list
  const list = document.getElementById("assignedList");
  list.innerHTML = "";
  if (assignedSubjects.length === 0) {
    list.innerHTML = `<p class="empty-msg">No subjects assigned yet.</p>`; return;
  }
  assignedSubjects.forEach(({ classCode, subject }) => {
    const item = document.createElement("div");
    item.className = "assigned-item";
    item.innerHTML = `<span class="assigned-class-tag">${classCode}</span>
                      <span class="assigned-subject">${subject}</span>`;
    list.appendChild(item);
  });

  // Stats
  document.getElementById("statSubjects").textContent = assignedSubjects.length;

  let totalStudents = 0, totalDone = 0;
  for (const code of assignedClasses) {
    const students = await fetchStudents(code);
    totalStudents += students.length;
    // Count reports done: assessments docs where teacher = uid + classCode
    for (const s of students) {
      for (const as of assignedSubjects.filter(a => a.classCode === code)) {
        const aSnap = await getDoc(doc(db, "assessments", `${s.id}_${as.subject}_${code}`));
        if (aSnap.exists() && aSnap.data().totalScore !== undefined) totalDone++;
      }
    }
  }
  document.getElementById("statStudents").textContent    = totalStudents;
  document.getElementById("statReportsDone").textContent = totalDone;
  document.getElementById("statPending").textContent     = Math.max(0, assignedSubjects.length * totalStudents - totalDone);
}

// ── FETCH STUDENTS (cached) ───────────────────
async function fetchStudents(classCode) {
  if (allStudents[classCode]) return allStudents[classCode];
  try {
    const q = query(collection(db, "users"),
      where("role", "in", ["student"]),
      where("classCode", "==", classCode),
      orderBy("indexNumber"));
    const snap = await getDocs(q);
    allStudents[classCode] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return allStudents[classCode];
  } catch (err) {
    // Fallback without orderBy if index missing
    const q2 = query(collection(db, "users"),
      where("role", "==", "student"),
      where("classCode", "==", classCode));
    const snap = await getDocs(q2);
    allStudents[classCode] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.indexNumber || "").localeCompare(b.indexNumber || ""));
    return allStudents[classCode];
  }
}

// ═══════════════════════════════════════════════
//   TAB: MY STUDENTS
// ═══════════════════════════════════════════════
document.getElementById("studentClassFilter").addEventListener("change", async e => {
  const code = e.target.value;
  if (!code) { document.getElementById("studentsTableBody").innerHTML =
    `<tr><td colspan="5" class="empty-msg">Select a class.</td></tr>`; return; }
  await renderStudentsTable(code);
});

async function renderStudentsTable(classCode) {
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Loading…</td></tr>`;
  const students = await fetchStudents(classCode);
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No students in ${classCode} yet.</td></tr>`; return;
  }
  tbody.innerHTML = students.map(s => `
    <tr>
      <td><code>${s.indexNumber || "—"}</code></td>
      <td>${s.displayName || s.name || "—"}</td>
      <td>${s.classCode || "—"}</td>
      <td>${s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : "—"}</td>
      <td>
        <a href="student.html?id=${s.id}" class="icon-btn" style="text-decoration:none">📄 Report</a>
      </td>
    </tr>`).join("");
}

// ── ADD STUDENT MODAL ─────────────────────────
document.getElementById("addStudentBtn").addEventListener("click", () => {
  document.getElementById("newStudentIndex").value = "";
  document.getElementById("newStudentName").value  = "";
  document.getElementById("addStudentModal").classList.remove("hidden");
});
document.getElementById("closeAddStudent").addEventListener("click", () => {
  document.getElementById("addStudentModal").classList.add("hidden");
});
document.getElementById("cancelAddStudent").addEventListener("click", () => {
  document.getElementById("addStudentModal").classList.add("hidden");
});

document.getElementById("newStudentClass").addEventListener("change", async e => {
  const code = e.target.value;
  if (!code) return;
  const students = await fetchStudents(code);
  const nextIndex = generateIndexNumber(code, students.length + 1);
  document.getElementById("newStudentIndex").value = nextIndex;
});

document.getElementById("confirmAddStudent").addEventListener("click", async () => {
  const classCode   = sanitizeInput(document.getElementById("newStudentClass").value.trim());
  const name        = sanitizeInput(document.getElementById("newStudentName").value.trim());
  const gender      = document.getElementById("newStudentGender").value;
  const phone       = sanitizeInput(document.getElementById("newStudentPhone").value.trim());
  const indexNumber = document.getElementById("newStudentIndex").value.trim();

  if (!classCode || !name || !indexNumber) { showToast("Please fill all required fields.", "error"); return; }

  try {
    // Add to users collection
    await addDoc(collection(db, "users"), {
      displayName: name,
      name,
      classCode,
      indexNumber,
      gender,
      guardianPhone: phone,
      role: "student",
      status: "active",
      createdBy: teacherUid,
      createdAt: serverTimestamp()
    });

    // Invalidate cache
    delete allStudents[classCode];
    document.getElementById("addStudentModal").classList.add("hidden");
    showToast(`Student ${name} added with index ${indexNumber}.`, "success");

    // Refresh table if visible
    const filter = document.getElementById("studentClassFilter").value;
    if (filter === classCode) await renderStudentsTable(classCode);

  } catch (err) {
    console.error(err);
    showToast("Failed to add student. " + err.message, "error");
  }
});

// ═══════════════════════════════════════════════
//   TAB: SCORES & REPORTS
// ═══════════════════════════════════════════════
document.getElementById("scoresClassFilter").addEventListener("change", e => {
  const code = e.target.value;
  const subjectSel = document.getElementById("scoresSubjectFilter");
  while (subjectSel.options.length > 1) subjectSel.remove(1);
  if (!code) return;
  const subjects = assignedSubjects.filter(s => s.classCode === code).map(s => s.subject);
  subjects.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub; opt.textContent = sub;
    subjectSel.appendChild(opt);
  });
});

document.getElementById("loadScoresBtn").addEventListener("click", async () => {
  const classCode = document.getElementById("scoresClassFilter").value;
  const subject   = document.getElementById("scoresSubjectFilter").value;
  if (!classCode || !subject) { showToast("Select a class and subject.", "error"); return; }
  await renderScoresTable(classCode, subject);
});

async function renderScoresTable(classCode, subject) {
  const tbody = document.getElementById("scoresTableBody");
  tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">Loading…</td></tr>`;
  const students = await fetchStudents(classCode);
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">No students found.</td></tr>`; return;
  }

  const remarks = getRemarks();
  const rows = await Promise.all(students.map(async s => {
    const docId   = `${s.id}_${subject}_${classCode}`;
    const aSnap   = await getDoc(doc(db, "assessments", docId));
    const existing = aSnap.exists() ? aSnap.data() : {};
    const assessment = existing.assessmentScore ?? "";
    const exam       = existing.examScore       ?? "";
    const total      = existing.totalScore      ?? "";
    const grade      = total !== "" ? getGrade(Number(total)) : "—";
    const savedRemark = existing.remark || "";
    const isCustom    = savedRemark && !remarks.includes(savedRemark);

    const remarkOptions = remarks.map(r =>
      `<option value="${r}" ${r === savedRemark ? "selected" : ""}>${r}</option>`).join("");

    return `<tr data-student-id="${s.id}" data-class="${classCode}" data-subject="${subject}">
      <td><code>${s.indexNumber || "—"}</code></td>
      <td>${s.displayName || s.name}</td>
      <td><input class="score-input assessment-score" type="number" min="0" max="40" value="${assessment}" placeholder="0–40"/></td>
      <td><input class="score-input exam-score"       type="number" min="0" max="60" value="${exam}"       placeholder="0–60"/></td>
      <td><span class="total-display total-cell">${total !== "" ? total : "—"}</span></td>
      <td><span class="grade-badge grade-${grade !== "—" ? grade[0] : "F"}">${grade}</span></td>
      <td>
        <select class="remark-select">
          <option value="">— Remark —</option>
          ${remarkOptions}
          <option value="__custom__" ${isCustom ? "selected" : ""}>✏️ Custom…</option>
        </select>
        <input class="remark-custom-input ${isCustom ? "" : "hidden"}" 
               type="text" placeholder="Type custom remark…" value="${isCustom ? savedRemark : ""}"/>
      </td>
      <td><button class="save-row-btn">💾 Save</button></td>
    </tr>`;
  }));

  tbody.innerHTML = rows.join("");

  // Live total calculation
  tbody.querySelectorAll("tr").forEach(row => {
    const aInput = row.querySelector(".assessment-score");
    const eInput = row.querySelector(".exam-score");
    const totalEl = row.querySelector(".total-cell");

    function recalcTotal() {
      const a = parseFloat(aInput.value) || 0;
      const e = parseFloat(eInput.value) || 0;
      const t = a + e;
      totalEl.textContent = (aInput.value !== "" || eInput.value !== "") ? t : "—";
      const g = t > 0 ? getGrade(t) : "—";
      const gb = row.querySelector(".grade-badge");
      gb.textContent = g;
      gb.className = `grade-badge grade-${g !== "—" ? g[0] : "F"}`;
    }
    aInput.addEventListener("input", recalcTotal);
    eInput.addEventListener("input", recalcTotal);

    // Custom remark toggle
    const remarkSel = row.querySelector(".remark-select");
    const customInp = row.querySelector(".remark-custom-input");
    remarkSel.addEventListener("change", () => {
      customInp.classList.toggle("hidden", remarkSel.value !== "__custom__");
    });
  });
}

// Save a single row's scores
document.getElementById("scoresTableBody").addEventListener("click", async e => {
  if (!e.target.classList.contains("save-row-btn")) return;
  const row      = e.target.closest("tr");
  const studentId = row.dataset.studentId;
  const classCode = row.dataset.class;
  const subject   = row.dataset.subject;

  const assessment = parseFloat(row.querySelector(".assessment-score").value) || 0;
  const exam       = parseFloat(row.querySelector(".exam-score").value)       || 0;
  const total      = assessment + exam;
  const grade      = getGrade(total);
  const remarkSel  = row.querySelector(".remark-select");
  const customInp  = row.querySelector(".remark-custom-input");
  const remark     = remarkSel.value === "__custom__"
    ? sanitizeInput(customInp.value.trim())
    : remarkSel.value;

  if (assessment > 40) { showToast("Assessment cannot exceed 40.", "error"); return; }
  if (exam       > 60) { showToast("Exam score cannot exceed 60.", "error"); return; }

  try {
    const docId = `${studentId}_${subject}_${classCode}`;
    await setDoc(doc(db, "assessments", docId), {
      studentId, classCode, subject,
      assessmentScore: assessment,
      examScore: exam,
      totalScore: total,
      grade,
      remark,
      teacherId: teacherUid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    showToast("Score saved.", "success");
    row.querySelector(".total-cell").textContent = total;

  } catch (err) {
    console.error(err);
    showToast("Failed to save: " + err.message, "error");
  }
});

// ═══════════════════════════════════════════════
//   TAB: ATTENDANCE
// ═══════════════════════════════════════════════
document.getElementById("loadAttendanceBtn").addEventListener("click", async () => {
  const classCode = document.getElementById("attendanceClassFilter").value;
  if (!classCode) { showToast("Select a class.", "error"); return; }
  await renderAttendanceTable(classCode);
});

document.getElementById("saveTermDaysBtn").addEventListener("click", async () => {
  const classCode = document.getElementById("attendanceClassFilter").value;
  const days      = parseInt(document.getElementById("termTotalDays").value);
  if (!classCode) { showToast("Select a class first.", "error"); return; }
  if (!days || days < 1) { showToast("Enter valid number of term days.", "error"); return; }
  try {
    await setDoc(doc(db, "system_config", `termDays_${classCode}`), {
      classCode, termDays: days,
      setBy: teacherUid, updatedAt: serverTimestamp()
    }, { merge: true });
    showToast(`Term days for ${classCode} saved: ${days} days.`, "success");
  } catch (err) {
    showToast("Failed to save term days.", "error");
  }
});

async function renderAttendanceTable(classCode) {
  const tbody = document.getElementById("attendanceTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Loading…</td></tr>`;

  // Load term days
  const configSnap = await getDoc(doc(db, "system_config", `termDays_${classCode}`));
  if (configSnap.exists()) {
    document.getElementById("termTotalDays").value = configSnap.data().termDays || "";
  }

  const students = await fetchStudents(classCode);
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No students.</td></tr>`; return;
  }

  const rows = await Promise.all(students.map(async s => {
    const aSnap = await getDoc(doc(db, "assessments", `attendance_${s.id}_${classCode}`));
    const att   = aSnap.exists() ? aSnap.data() : {};
    const present = att.daysPresent ?? "";
    const termDays = parseInt(document.getElementById("termTotalDays").value) || 0;
    const absent  = termDays && present !== "" ? termDays - parseInt(present) : "—";

    return `<tr data-student-id="${s.id}" data-class="${classCode}">
      <td><code>${s.indexNumber || "—"}</code></td>
      <td>${s.displayName || s.name}</td>
      <td><input class="days-input days-present" type="number" min="0" value="${present}" placeholder="Days present"/></td>
      <td><span class="days-absent-display">${absent}</span></td>
      <td><button class="save-row-btn">💾 Save</button></td>
    </tr>`;
  }));
  tbody.innerHTML = rows.join("");

  // Live absent calc
  tbody.querySelectorAll("tr").forEach(row => {
    const inp = row.querySelector(".days-present");
    const absEl = row.querySelector(".days-absent-display");
    const termDays = parseInt(document.getElementById("termTotalDays").value) || 0;
    inp.addEventListener("input", () => {
      absEl.textContent = termDays ? Math.max(0, termDays - (parseInt(inp.value) || 0)) : "—";
    });
  });
}

// Save attendance row
document.getElementById("attendanceTableBody").addEventListener("click", async e => {
  if (!e.target.classList.contains("save-row-btn")) return;
  const row       = e.target.closest("tr");
  const studentId = row.dataset.studentId;
  const classCode = row.dataset.class;
  const present   = parseInt(row.querySelector(".days-present").value) || 0;
  const termDays  = parseInt(document.getElementById("termTotalDays").value) || 0;

  try {
    await setDoc(doc(db, "assessments", `attendance_${studentId}_${classCode}`), {
      studentId, classCode,
      daysPresent: present,
      daysAbsent: termDays ? termDays - present : null,
      termDays: termDays || null,
      teacherId: teacherUid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showToast("Attendance saved.", "success");
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
});

// ═══════════════════════════════════════════════
//   TAB: CLASS RANKING
// ═══════════════════════════════════════════════

// Populate ranking class selector — only formClass if form teacher
if (isFormTeacher && formClass) {
  const rSel = document.getElementById("rankingClassFilter");
  while (rSel.options.length > 1) rSel.remove(1);
  const opt = document.createElement("option");
  opt.value = formClass; opt.textContent = formClass;
  rSel.appendChild(opt);
}

document.getElementById("computeRankingBtn").addEventListener("click", async () => {
  const classCode = document.getElementById("rankingClassFilter").value;
  if (!classCode) { showToast("Select a class.", "error"); return; }
  await computeAndRenderRanking(classCode);
});

async function computeAndRenderRanking(classCode) {
  const tbody = document.getElementById("rankingTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Computing…</td></tr>`;

  const students = await fetchStudents(classCode);
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No students.</td></tr>`; return;
  }

  // Get all subjects for this class
  const subjects = assignedSubjects.filter(s => s.classCode === classCode).map(s => s.subject);

  // Fetch totals per student
  const studentTotals = await Promise.all(students.map(async s => {
    let grand = 0; let count = 0;
    for (const sub of subjects) {
      const snap = await getDoc(doc(db, "assessments", `${s.id}_${sub}_${classCode}`));
      if (snap.exists() && snap.data().totalScore !== undefined) {
        grand += snap.data().totalScore || 0;
        count++;
      }
    }
    return { ...s, grandTotal: grand, subjectCount: count,
             average: count ? (grand / count).toFixed(1) : "0" };
  }));

  // Sort descending
  studentTotals.sort((a, b) => b.grandTotal - a.grandTotal);

  // Assign ranks (handle ties)
  let rank = 1;
  studentTotals.forEach((s, i) => {
    if (i > 0 && s.grandTotal === studentTotals[i - 1].grandTotal) {
      s.rank = studentTotals[i - 1].rank;
    } else {
      s.rank = rank;
    }
    rank++;
  });

  tbody.innerHTML = studentTotals.map(s => {
    const rankClass = s.rank === 1 ? "rank-1" : s.rank === 2 ? "rank-2" : s.rank === 3 ? "rank-3" : "";
    return `<tr data-student-id="${s.id}" data-rank="${s.rank}" data-total="${s.grandTotal}">
      <td><span class="rank-num ${rankClass}">${s.rank}</span></td>
      <td><code>${s.indexNumber || "—"}</code></td>
      <td>${s.displayName || s.name}</td>
      <td><strong>${s.grandTotal}</strong></td>
      <td>${s.average}</td>
      <td>${s.subjectCount}</td>
    </tr>`;
  }).join("");

  document.getElementById("rankingFooter").classList.remove("hidden");
  // Store for saving
  window._rankingData = { classCode, students: studentTotals };
}

document.getElementById("saveRankingBtn").addEventListener("click", async () => {
  if (!window._rankingData) return;
  const { classCode, students } = window._rankingData;
  try {
    for (const s of students) {
      await setDoc(doc(db, "assessments", `rank_${s.id}_${classCode}`), {
        studentId: s.id, classCode,
        rank: s.rank, grandTotal: s.grandTotal,
        average: s.average,
        rankedBy: teacherUid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    showToast("Rankings saved successfully.", "success");
  } catch (err) {
    showToast("Failed to save rankings: " + err.message, "error");
  }
});

// ═══════════════════════════════════════════════
//   TAB: SUBMIT REPORT
// ═══════════════════════════════════════════════
document.getElementById("submitReportBtn").addEventListener("click", async () => {
  const classCode = document.getElementById("submitClassSelect").value;
  const note      = sanitizeInput(document.getElementById("teacherNote").value.trim());

  if (!classCode) { showToast("Select a class to submit.", "error"); return; }

  const statusEl = document.getElementById("submitStatus");
  statusEl.style.display = "block";
  statusEl.className = "submit-status glass-card";
  statusEl.textContent = "Submitting report…";

  try {
    // Create a submission doc
    await addDoc(collection(db, "admin_logs"), {
      type: "class_report_submission",
      classCode,
      teacherId: teacherUid,
      teacherName: currentTeacher?.displayName || currentTeacher?.name || "Teacher",
      teacherNote: note,
      status: "pending_admin_review",
      submittedAt: serverTimestamp()
    });

    // Notify admin via mail collection
    await sendEmailNotification(
      "admin@ktawiah.edu",
      `Class Report Submitted — ${classCode}`,
      `Teacher ${currentTeacher?.displayName || "—"} has submitted the class report for ${classCode}. 
       Please review and add your remarks before publishing.\n\nTeacher's note: ${note || "None"}`
    );

    // Update teacher's submission status
    await updateDoc(doc(db, "users", teacherUid), {
      [`reportSubmitted_${classCode}`]: true,
      [`reportSubmittedAt_${classCode}`]: serverTimestamp()
    });

    statusEl.className = "submit-status glass-card success";
    statusEl.textContent = `✅ Report for ${classCode} submitted successfully! Admin will review and publish.`;
    showToast("Report submitted to admin.", "success");

  } catch (err) {
    console.error(err);
    statusEl.className = "submit-status glass-card error";
    statusEl.textContent = "❌ Submission failed: " + err.message;
    showToast("Submission failed.", "error");
  }
});

// ═══════════════════════════════════════════════
//   TAB: MY PROFILE — Student Report Links
// ═══════════════════════════════════════════════
async function loadProfileStudents(filterClass = "") {
  const list = document.getElementById("studentReportList");
  list.innerHTML = `<li class="empty-msg">Loading…</li>`;

  const classes = filterClass ? [filterClass] : assignedClasses;
  let allStudentsList = [];
  for (const code of classes) {
    const students = await fetchStudents(code);
    allStudentsList = allStudentsList.concat(students);
  }

  if (allStudentsList.length === 0) {
    list.innerHTML = `<li class="empty-msg">No students found.</li>`; return;
  }

  list.innerHTML = allStudentsList.map(s => `
    <li class="student-report-item">
      <a class="report-link" href="student.html?id=${s.id}" target="_blank">
        🎓 ${s.displayName || s.name || "—"}
      </a>
      <span class="student-index-tag">${s.indexNumber || "—"} · ${s.classCode || "—"}</span>
    </li>`).join("");
}

document.getElementById("profileClassFilter").addEventListener("change", e => {
  loadProfileStudents(e.target.value);
});

// ═══════════════════════════════════════════════
//   TAB SWITCHING
// ═══════════════════════════════════════════════
const tabTitles = {
  overview:   "Overview",
  students:   "My Students",
  scores:     "Scores & Reports",
  attendance: "Attendance",
  ranking:    "Class Ranking",
  submit:     "Submit Report",
  profile:    "My Profile"
};

function switchTab(name) {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab-content").forEach(sec => {
    sec.classList.toggle("active", sec.id === `tab-${name}`);
  });
  document.getElementById("pageTitle").textContent      = tabTitles[name] || name;
  document.getElementById("pageBreadcrumb").textContent = `Dashboard › ${tabTitles[name] || name}`;
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Expose for quick actions
window.switchTab = switchTab;

// ═══════════════════════════════════════════════
//   SIGN OUT
// ═══════════════════════════════════════════════
document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// ═══════════════════════════════════════════════
//   TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toastContainer");
  const toast     = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}