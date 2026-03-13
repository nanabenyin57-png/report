import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = { /* Your Config */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadTerminalReport(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

async function loadTerminalReport(studentId) {
    try {
        // 1. Fetch Student Profile for Header Data
        const userDoc = await getDoc(doc(db, "users", studentId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById("card-name").innerText = `${userData.firstName} ${userData.lastName}`.toUpperCase();
            document.getElementById("card-class").innerText = userData.department || "N/A";
            document.getElementById("student-welcome").innerText = `Welcome, ${userData.firstName}`;
        }

        // 2. Fetch Remarks & Assessment
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

        // 3. Fetch Subject Scores
        const scoreQuery = query(collection(db, "published_reports"), where("studentId", "==", studentId));
        const scoreSnap = await getDocs(scoreQuery);
        
        let reportHTML = "";
        scoreSnap.forEach((doc) => {
            const s = doc.data();
            reportHTML += `
                <tr>
                    <td style="text-align:left; padding-left:10px;">${s.subject.toUpperCase()}</td>
                    <td>${s.sba50}</td>
                    <td>${s.exam50}</td>
                    <td style="font-weight:bold;">${s.total100}</td>
                    <td>${getLetterGrade(s.total100)}</td>
                    <td>STAFF</td>
                </tr>`;
        });
        document.getElementById("report-body").innerHTML = reportHTML || "<tr><td colspan='6'>No records found for this term.</td></tr>";

    } catch (error) {
        console.error("Error generating report:", error);
    }
}

// Helper to match the Image's Grading System
function getLetterGrade(score) {
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    IF (score >= 40) return "E";
    return "F";
}