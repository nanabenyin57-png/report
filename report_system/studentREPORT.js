import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 1. THE MISSING PIECE: Full Config Object
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169",
  measurementId: "G-KBTRR8YZFJ"
};

// 2. INITIALIZATION
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. READ THE STUDENT ID FROM THE URL
const urlParams = new URLSearchParams(window.location.search);
const studentIdFromUrl = urlParams.get('id');

// 4. AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // If a teacher clicked a link, use studentIdFromUrl. 
        // If a student logged in directly, use user.uid.
        const targetId = studentIdFromUrl || user.uid;
        console.log("Fetching report for:", targetId);
        loadTerminalReport(targetId);
    } else {
        window.location.href = "index.html";
    }
});

// 5. DATA LOADING LOGIC
async function loadTerminalReport(studentId) {
    try {
        // Fetch Student Personal Info
        const userDoc = await getDoc(doc(db, "users", studentId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById("card-name").innerText = `${userData.firstName} ${userData.lastName}`.toUpperCase();
            document.getElementById("card-class").innerText = userData.department || "N/A";
        }

        // Fetch Assessment/Remarks
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

        // Fetch Subject Scores
        const scoreQuery = query(collection(db, "published_reports"), where("studentId", "==", studentId));
        const scoreSnap = await getDocs(scoreQuery);
        
        let reportHTML = "";
        scoreSnap.forEach((doc) => {
            const s = doc.data();
            const total = parseFloat(s.total100);
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
        
        const tbody = document.getElementById("report-body");
        if (tbody) {
            tbody.innerHTML = reportHTML || "<tr><td colspan='6'>No results published yet.</td></tr>";
        }

    } catch (error) {
        console.error("Error loading report card:", error);
    }
}

// 6. GRADING SYSTEM (Matching the M.A. Bediako Standard)
function getLetterGrade(score) {
    if (score >= 80) return "A (Advance)";
    if (score >= 75) return "P (Proficient)";
    if (score >= 70) return "AP (Approaching Proficiency)";
    if (score >= 65) return "D (Developing)";
    return "B (Beginning)";
}

// 7. UI HANDLER (Toggle Menu)
window.toggleMenu = function() {
    document.getElementById("navover").classList.toggle("open");
};