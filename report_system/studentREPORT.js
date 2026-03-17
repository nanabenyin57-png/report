import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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

// Initialize Firebase immediately
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Check for ID in URL
const urlParams = new URLSearchParams(window.location.search);
const studentIdFromUrl = urlParams.get('id');

onAuthStateChanged(auth, (user) => {
    if (user) {
        const targetId = studentIdFromUrl || user.uid;
        loadTerminalReport(targetId);
    } else {
        // Only redirect if we are SURE there is no user
        console.warn("No user found, redirecting to login...");
        window.location.replace("index.html"); 
    }
});


async function loadTerminalReport(studentId) {
    try {
        // 1. Student Info
        const userDoc = await getDoc(doc(db, "users", studentId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById("card-name").innerText = `${userData.firstName} ${userData.lastName}`.toUpperCase();
            document.getElementById("card-class").innerText = userData.department || "N/A";
        }

        // 2. Remarks
        const remarkDoc = await getDoc(doc(db, "student_remarks", studentId));
        if (remarkDoc.exists()) {
            const r = remarkDoc.data();
            document.getElementById("card-pos").innerText = r.position || "---";
            document.getElementById("card-roll").innerText = r.classSize || "---";
            document.getElementById("res-interest").innerText = r.interest || "---";
            document.getElementById("res-conduct").innerText = r.conduct || "---";
            document.getElementById("res-t-remark").innerText = r.teacherRemarks || "---";
            document.getElementById("res-a-remark").innerText = r.headRemarks || "---";
        }

        // 3. Scores
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
                    <td>STAFF</td>
                </tr>`;
        });
        document.getElementById("report-body").innerHTML = reportHTML || "<tr><td colspan='6'>No records found.</td></tr>";

    } catch (error) {
        console.error("Firebase Error:", error);
    }
}

function getLetterGrade(score) {
    if (score >= 80) return "A";
    if (score >= 75) return "P";
    if (score >= 70) return "AP";
    if (score >= 65) return "D";
    return "B";
}

// UI HANDLER - Toggle Menu
window.toggleMenu = function() {
    const nav = document.getElementById("navover");
    if (nav) {
        nav.classList.toggle("open");
    }
};

// Close menu when clicking a link
document.querySelectorAll('.links a').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById("navover").classList.remove("open");
    });
});
window.viewReportCard = function(studentId) {
    if (!studentId) return alert("Student ID not found.");
    // This is likely the culprit
    window.location.href = `student_report.html?id=${studentId}`;
};