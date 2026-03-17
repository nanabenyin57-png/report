import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- START CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
    authDomain: "reportbase-669ff.firebaseapp.com",
    projectId: "reportbase-669ff",
    storageBucket: "reportbase-669ff.firebasestorage.app",
    messagingSenderId: "244941864396",
    appId: "1:244941864396:web:aebc946e160a0172edf169",
    measurementId: "G-KBTRR8YZFJ"
};
// --- END CONFIG ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const studentIdFromUrl = urlParams.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Check if the logged-in user is a Teacher
        const viewerDoc = await getDoc(doc(db, "users", user.uid));
        const userData = viewerDoc.data();
        const isTeacher = userData && (userData.role === "teacher" || userData.role === "admin");

        // 2. Decide whose report card to show
        const targetId = studentIdFromUrl || user.uid;
        loadTerminalReport(targetId, isTeacher);
    } else {
        window.location.replace("index.html"); 
    }
});

async function loadTerminalReport(studentId, isTeacher) {
    try {
        // A. Load Student Profile Info
        const userDoc = await getDoc(doc(db, "users", studentId));
        if (userDoc.exists()) {
            const s = userDoc.data();
            document.getElementById("card-name").innerText = `${s.firstName} ${s.lastName}`.toUpperCase();
            document.getElementById("card-class").innerText = s.department || "N/A";
        }

        // B. Setup Editing Mode for Teachers
        if (isTeacher) {
            enableTeacherEditing(studentId);
        }

      // ... inside loadTerminalReport ...
const remarkDoc = await getDoc(doc(db, "student_remarks", studentId));
if (remarkDoc.exists()) {
    const r = remarkDoc.data();
    if (isTeacher) {
        document.getElementById("inp-interest").value = r.interest || "";
        document.getElementById("inp-conduct").value = r.conduct || "";
        document.getElementById("inp-t-remark").value = r.teacherRemarks || "";
        document.getElementById("inp-h-remark").value = r.headRemarks || ""; // New
    } else {
        document.getElementById("res-interest").innerText = r.interest || "---";
        document.getElementById("res-conduct").innerText = r.conduct || "---";
        document.getElementById("res-t-remark").innerText = r.teacherRemarks || "---";
        document.getElementById("res-h-remark").innerText = r.headRemarks || "---"; // New
    }
}

        // D. Load Subject Scores
        const scoreQuery = query(collection(db, "published_reports"), where("studentId", "==", studentId));
        const scoreSnap = await getDocs(scoreQuery);
        
        let reportHTML = "";
        scoreSnap.forEach((doc) => {
            const s = doc.data();
            const total = parseFloat(s.total100) || 0;
            reportHTML += `
                <tr>
                    <td style="text-align:left; padding-left:10px;">${s.subject.toUpperCase()}</td>
                    <td>${s.sba50}</td>
                    <td>${s.exam50}</td>
                    <td style="font-weight:bold;">${total.toFixed(1)}</td>
                    <td>${getLetterGrade(total)}</td>
                    
                </tr>`;
        });
        document.getElementById("report-body").innerHTML = reportHTML || "<tr><td colspan='6'>No records found.</td></tr>";

    } catch (error) {
        console.error("Firebase Error:", error);
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
        { id: "res-h-remark", inputId: "inp-h-remark" } // Added
    ];

    fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (el) {
            el.innerHTML = `<input type="text" id="${field.inputId}" class="edit-input" placeholder="Enter remark...">`;
        }
    });

    saveBtn.onclick = async () => {
        saveBtn.innerText = "Saving to Firebase...";
        try {
            await setDoc(doc(db, "student_remarks", studentId), {
                interest: document.getElementById("inp-interest").value,
                conduct: document.getElementById("inp-conduct").value,
                teacherRemarks: document.getElementById("inp-t-remark").value,
                headRemarks: document.getElementById("inp-h-remark").value, // Added
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            saveBtn.innerText = "REMARKS SAVED!";
            saveBtn.style.background = "var(--secondary-neon)";
        } catch (e) {
            console.error(e);
            saveBtn.innerText = "Error Saving";
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
window.toggleMenu = function() {
    const nav = document.getElementById("navover");
    if (nav) nav.classList.toggle("open");
};

window.viewReportCard = function(studentId) {
    if (!studentId) return alert("Student ID not found.");
    window.location.href = `student_report.html?id=${studentId}`;
};