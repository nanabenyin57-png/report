// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, getDocs, collection, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 2. CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169",
  measurementId: "G-KBTRR8YZFJ"
};

// 3. INITIALIZATION
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let allStudents = []; 

// 4. AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role === "admin" || userData.role === "teacher") {
                    if (adminSec) adminSec.style.display = "block";
                    statusMsg.innerText = `Welcome, ${userData.firstName} (Staff)`;
                    await fetchStudents(); 
                } else {
                    window.location.href = "student_report.html"; 
                }
            }
        } catch (error) {
            console.error("Auth error:", error);
        }
    } else { 
        window.location.href = "index.html"; 
    }
});

async function fetchStudents() {
    const q = query(collection(firestore, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);
    allStudents = querySnapshot.docs.map(doc => ({
        uid: doc.id, 
        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
    }));
}

// 5. THE NEW COMPILATION LOGIC
window.generateFinalReport = async function() {
    const tablebody = document.getElementById("tablebody");
    const headerrow = document.getElementById("headerrow");
    const dept = document.getElementById("department").value;

    if (dept === "choose_a_department") return alert("Please select a department!");

    tablebody.innerHTML = "<tr><td colspan='6'>Compiling scores from Assessments and Exams...</td></tr>";
    
    // Set Header for Final Report
    headerrow.innerHTML = `
        <th>STUDENT NAME</th>
        <th>SUBJECT</th>
        <th>SBA (50%)</th>
        <th>EXAM (50%)</th>
        <th>TOTAL (100%)</th>
        <th>GRADE</th>
    `;

    try {
        tablebody.innerHTML = ""; // Clear for data

        for (let student of allStudents) {
            // Fetch SBA and Exams for this student
            const [sbaSnap, examSnap] = await Promise.all([
                getDocs(query(collection(firestore, "assessments"), where("studentId", "==", student.uid))),
                getDocs(query(collection(firestore, "exams"), where("studentId", "==", student.uid)))
            ]);

            const sbaScores = {};
            sbaSnap.forEach(doc => { sbaScores[doc.data().subject] = parseFloat(doc.data().scaled50); });

            const examScores = {};
            examSnap.forEach(doc => { examScores[doc.data().subject] = parseFloat(doc.data().scaledScore); });

            // Merge subjects
            const subjects = [...new Set([...Object.keys(sbaScores), ...Object.keys(examScores)])];

            subjects.forEach(sub => {
                const sba = sbaScores[sub] || 0;
                const exam = examScores[sub] || 0;
                const total = sba + exam;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${student.name}</td>
                    <td>${sub}</td>
                    <td>${sba.toFixed(1)}</td>
                    <td>${exam.toFixed(1)}</td>
                    <td style="color:cyan; font-weight:bold;">${total.toFixed(1)}</td>
                    <td>${calculateGrade(total)}</td>
                `;
                tablebody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error(e);
        alert("Error compiling report.");
    }
};

// 6. GRADING UTILITY
function calculateGrade(score) {
    if (score >= 80) return "A1";
    if (score >= 70) return "B2";
    if (score >= 60) return "B3";
    if (score >= 55) return "C4";
    if (score >= 50) return "C5";
    if (score >= 45) return "D7"; // Adjusted for Ghanaian scale
    return "F9";
}

// 7. UI & MENU
window.toggleMenu = function() {
    const navOverlay = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    navOverlay.classList.toggle("open");
    navBtn.innerHTML = navOverlay.classList.contains("open") ? "&times;" : "&#9776;";
};

// EXPOSE TO GLOBAL
window.table_head = () => { /* Now handled by generateFinalReport */ };
window.genrows = window.generateFinalReport; 
window.toggleMenu = window.toggleMenu;

// EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", window.generateFinalReport);
});