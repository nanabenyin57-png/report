import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig, calculateGrade, sanitizeInput, showNotification, MESSAGES } from "./config.js";

// --- END CONFIG ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const studentIdFromUrl = sanitizeInput(urlParams.get('id') || '');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }

    try {
        // 1. Check if the logged-in user is a Teacher or the student themselves
        const viewerDoc = await getDoc(doc(db, "users", user.uid));
        if (!viewerDoc.exists()) {
            showNotification("User profile not found", "error");
            window.location.replace("index.html");
            return;
        }

        const userData = viewerDoc.data();
        const isTeacher = userData && (userData.role === "teacher" || userData.role === "admin");
        const isStudentViewingOwn = user.uid === studentIdFromUrl;

        // 2. Security check: Only teachers or the student themselves can view reports
        if (!isTeacher && !isStudentViewingOwn && studentIdFromUrl) {
            showNotification("Access denied: You can only view your own reports", "error");
            window.location.replace("student_report.html");
            return;
        }

        // 3. Determine whose report to show
        const targetId = studentIdFromUrl || user.uid;

        // 4. Additional security: If teacher is viewing, verify they have permission
        if (isTeacher && studentIdFromUrl && studentIdFromUrl !== user.uid) {
            // Check if the teacher has this student assigned
            const studentDoc = await getDoc(doc(db, "users", targetId));
            if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                if (studentData.teacherId !== user.uid && userData.role !== "admin") {
                    showNotification("Access denied: This student is not assigned to you", "error");
                    window.location.replace("report.html");
                    return;
                }
            }
        }

        loadTerminalReport(targetId, isTeacher);
    } catch (error) {
        console.error("Auth Error:", error);
        showNotification(MESSAGES.errors.auth, "error");
        window.location.replace("index.html");
    }
});

async function loadTerminalReport(studentId, isTeacher) {
    try {
        // A. Load Student Profile Info
        const userDoc = await getDoc(doc(db, "users", studentId));
        if (userDoc.exists()) {
            const s = userDoc.data();
            document.getElementById("card-name").innerText = `${sanitizeInput(s.firstName || '')} ${sanitizeInput(s.lastName || '')}`.toUpperCase();
            document.getElementById("card-class").innerText = s.department || "N/A";
        } else {
            showNotification("Student profile not found", "error");
            return;
        }

        // B. Setup Editing Mode for Teachers
        if (isTeacher) {
            enableTeacherEditing(studentId);
        }

        // C. Load Subject Scores
        const scoreQuery = query(collection(db, "published_reports"), where("studentId", "==", studentId));
        const scoreSnap = await getDocs(scoreQuery);

        let reportHTML = "";
        scoreSnap.forEach((doc) => {
            const s = doc.data();
            const total = parseFloat(s.total100) || 0;
            reportHTML += `
                <tr>
                    <td style="text-align:left; padding-left:10px;">${sanitizeInput(s.subject || '').toUpperCase()}</td>
                    <td>${s.sba50 || '0'}</td>
                    <td>${s.exam50 || '0'}</td>
                    <td style="font-weight:bold;">${total.toFixed(1)}</td>
                    <td>${calculateGrade(total)}</td>
                </tr>`;
        });
        document.getElementById("report-body").innerHTML = reportHTML || "<tr><td colspan='6'>No records found.</td></tr>";

        // D. Load Remarks
        const remarkDoc = await getDoc(doc(db, "student_remarks", studentId));
        if (remarkDoc.exists()) {
            const r = remarkDoc.data();
            if (isTeacher) {
                document.getElementById("inp-interest").value = sanitizeInput(r.interest || "");
                document.getElementById("inp-conduct").value = sanitizeInput(r.conduct || "");
                document.getElementById("inp-t-remark").value = sanitizeInput(r.teacherRemarks || "");
                document.getElementById("inp-h-remark").value = sanitizeInput(r.headRemarks || "");
            } else {
                document.getElementById("res-interest").innerText = sanitizeInput(r.interest || "---");
                document.getElementById("res-conduct").innerText = sanitizeInput(r.conduct || "---");
                document.getElementById("res-t-remark").innerText = sanitizeInput(r.teacherRemarks || "---");
                document.getElementById("res-h-remark").innerText = sanitizeInput(r.headRemarks || "---");
            }
        }

    } catch (error) {
        console.error("Firebase Error:", error);
        showNotification(MESSAGES.errors.network, "error");
        document.getElementById("report-body").innerHTML = "<tr><td colspan='6' style='color: #ff4444;'>Error loading data. Please try again.</td></tr>";
    }
}
function enableTeacherEditing(studentId) {
    const saveBtn = document.getElementById("btnSaveRemarks");
    if(saveBtn) saveBtn.style.display = "block";

    // Convert spans to inputs including Head Teacher
    const fields = [
        { id: "res-interest", inputId: "inp-interest" },
        { id: "res-conduct", inputId: "inp-conduct" },
        { id: "res-t-remark", inputId: "inp-t-remark" },
        { id: "res-h-remark", inputId: "inp-h-remark" }
    ];

    fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (el) {
            el.innerHTML = `<input type="text" id="${field.inputId}" class="edit-input" placeholder="Enter remark..." maxlength="200">`;
        }
    });

    saveBtn.onclick = async () => {
        const interest = sanitizeInput(document.getElementById("inp-interest").value);
        const conduct = sanitizeInput(document.getElementById("inp-conduct").value);
        const teacherRemarks = sanitizeInput(document.getElementById("inp-t-remark").value);
        const headRemarks = sanitizeInput(document.getElementById("inp-h-remark").value);

        saveBtn.innerText = MESSAGES.loading.saving;
        saveBtn.disabled = true;

        try {
            await setDoc(doc(db, "student_remarks", studentId), {
                interest: interest,
                conduct: conduct,
                teacherRemarks: teacherRemarks,
                headRemarks: headRemarks,
                lastUpdated: serverTimestamp()
            }, { merge: true });

            showNotification(MESSAGES.success.saved, "success");
            saveBtn.innerText = "REMARKS SAVED!";
            saveBtn.style.background = "var(--secondary-neon)";
        } catch (error) {
            console.error("Save Error:", error);
            showNotification(MESSAGES.errors.save, "error");
            saveBtn.innerText = "Error Saving";
        } finally {
            saveBtn.disabled = false;
        }
    };
}
function getLetterGrade(score) {
    if (score >= 80) return "A (Excellent)";
    if (score >= 70) return "B (Very Good)";
    if (score >= 60) return "C (Good)";
    if (score >= 50) return "D (Credit)";
    if (score >= 40) return "E (Pass)";
    return "F (Fail)";
}

// NAVIGATION HANDLERS
window.viewReportCard = function(studentId) {
    if (!studentId) return alert("Student ID not found.");
    window.location.href = `student_report.html?id=${studentId}`;
};