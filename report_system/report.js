// 1. CLEAN & INTACT IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    setDoc, 
    addDoc, 
    serverTimestamp 
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
let currentTeacherUid = null;

// 4. AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        currentTeacherUid = user.uid;
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


async function checkTeacherStatus(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.role === "teacher") {
            if (userData.authorized === true) {
                // SUCCESS: Show the full glassmorphic dashboard
                document.getElementById("dashboard-section").style.display = "block";
                document.getElementById("pending-screen").style.display = "none";
            } else {
                // LOCKED: Show the "Wait for Admin" screen
                document.getElementById("dashboard-section").style.display = "none";
                document.getElementById("pending-screen").style.display = "flex";
            }
        }
    }
}
// 5. FETCH ONLY MY STUDENTS
async function fetchStudents() {
    try {
        const q = query(
            collection(firestore, "users"), 
            where("role", "==", "student"),
            where("teacherId", "==", currentTeacherUid) 
        );
        
        const querySnapshot = await getDocs(q);
        allStudents = querySnapshot.docs.map(doc => ({
            uid: doc.id, 
            name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
        }));
        console.log(`Success: Loaded ${allStudents.length} of your students.`);
    } catch (error) {
        console.error("Error fetching filtered students:", error);
    }
}

// 6. REGISTER NEW STUDENT
window.registerStudent = async function() {
    const indexNo = document.getElementById("reg-index").value.trim();
    const fname = document.getElementById("reg-fname").value.trim();
    const lname = document.getElementById("reg-lname").value.trim();
    const status = document.getElementById("reg-status");

    if (!indexNo || !fname || !lname) return alert("Please fill all registration fields!");

    status.innerText = "Creating Profile...";
    try {
        await setDoc(doc(firestore, "users", indexNo), {
            firstName: fname,
            lastName: lname,
            indexNo: indexNo,
            role: "student",
            teacherId: currentTeacherUid, 
            createdAt: serverTimestamp()
        });
        
        status.style.color = "#00ff88";
        status.innerText = `Success: ${indexNo} Registered`;
        
        // Clear inputs and refresh list
        document.getElementById("reg-index").value = "";
        document.getElementById("reg-fname").value = "";
        document.getElementById("reg-lname").value = "";
        await fetchStudents(); 
        
    } catch (e) {
        console.error(e);
        status.style.color = "#ff4d4d";
        status.innerText = "Error: Check Firestore Rules.";
    }
};

// 7. COMPILATION LOGIC (50/50 JOIN)
window.generateFinalReport = async function() {
    const tablebody = document.getElementById("tablebody");
    const dept = document.getElementById("department").value;

    if (dept === "choose_a_department") return alert("Please select a department!");

    tablebody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Merging Assessment and Exam data...</td></tr>";

    try {
        let reportHTML = "";

        for (let student of allStudents) {
            const [sbaSnap, examSnap] = await Promise.all([
                getDocs(query(collection(firestore, "assessments"), where("studentId", "==", student.uid))),
                getDocs(query(collection(firestore, "exams"), where("studentId", "==", student.uid)))
            ]);

            const sbaScores = {};
            sbaSnap.forEach(doc => { sbaScores[doc.data().subject] = parseFloat(doc.data().scaled50) || 0; });

            const examScores = {};
            examSnap.forEach(doc => { examScores[doc.data().subject] = parseFloat(doc.data().scaledScore) || 0; });

            const subjects = [...new Set([...Object.keys(sbaScores), ...Object.keys(examScores)])];

            subjects.forEach(sub => {
                const sba = sbaScores[sub] || 0;
                const exam = examScores[sub] || 0;
                const total = sba + exam;

                reportHTML += `
                    <tr>
                        <td>${student.name}</td>
                        <td>${sub}</td>
                        <td>${sba.toFixed(1)}</td>
                        <td>${exam.toFixed(1)}</td>
                        <td style="color:#00e5ff; font-weight:bold;">${total.toFixed(1)}</td>
                        <td>${calculateGrade(total)}</td>
                    </tr>
                `;
            });
        }
        tablebody.innerHTML = reportHTML || "<tr><td colspan='6'>No records found.</td></tr>";
    } catch (e) {
        console.error(e);
        alert("Compilation failed. Check browser console.");
    }
};

// 8. GRADING UTILITY
function calculateGrade(score) {
    if (score >= 80) return "A1 (Excellent)";
    if (score >= 70) return "B2 (Very Good)";
    if (score >= 60) return "B3 (Good)";
    if (score >= 55) return "C4 (Credit)";
    if (score >= 50) return "C5 (Credit)";
    if (score >= 45) return "D7 (Pass)";
    return "F9 (Fail)";
}

// 9. PUBLISH TO STUDENTS
window.publishToStudents = async function() {
    const rows = document.querySelectorAll("#tablebody tr");
    const dept = document.getElementById("department").value;

    if (rows.length === 0 || rows[0].cells.length < 6) {
        return alert("Please generate the report first!");
    }

    const btn = document.getElementById("btnSave");
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
        for (let row of rows) {
            const cells = row.cells;
            const studentName = cells[0].innerText;
            const subject = cells[1].innerText;
            const sba = cells[2].innerText;
            const exam = cells[3].innerText;
            const total = cells[4].innerText;
            const grade = cells[5].innerText;

            const student = allStudents.find(s => s.name === studentName);
            const studentId = student ? student.uid : "unknown";

            const reportId = `${studentId}_${subject.replace(/\s+/g, '_')}`; 
            
            await setDoc(doc(firestore, "published_reports", reportId), {
                studentId: studentId,
                studentName: studentName,
                department: dept,
                subject: subject,
                sba50: sba,
                exam50: exam,
                total100: total,
                grade: grade,
                teacherUid: currentTeacherUid,
                publishedAt: serverTimestamp()
            });
        }

        alert("All results published!");
        btn.innerText = "Published Successfully";
        btn.style.background = "rgba(0, 255, 136, 0.3)";
    } catch (error) {
        console.error("Publish Error:", error);
        alert("Failed to publish.");
        btn.disabled = false;
        btn.innerText = "Publish to Students";
    }
};

// 10. UI HANDLERS
window.toggleMenu = function() {
    document.getElementById("navover").classList.toggle("open");
};

// 11. EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", window.generateFinalReport);
    document.getElementById("btnRegisterStudent")?.addEventListener("click", window.registerStudent);
    document.getElementById("btnSave")?.addEventListener("click", window.publishToStudents);
});