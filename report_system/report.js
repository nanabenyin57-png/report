// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, serverTimestamp 
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

// Attach to window for global access
window.auth = auth;
window.firestore = firestore;

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

// 5. REGISTRATION & FETCHING
async function registerStudent() {
    const indexNo = document.getElementById("reg-index").value.trim();
    const fname = document.getElementById("reg-fname").value.trim();
    const lname = document.getElementById("reg-lname").value.trim();
    const status = document.getElementById("reg-status");

    if (!indexNo || !fname || !lname) {
        alert("Please fill in all registration fields!");
        return;
    }

    try {
        status.innerText = "Processing...";
        await setDoc(doc(firestore, "users", indexNo), {
            firstName: fname,
            lastName: lname,
            indexNo: indexNo,
            role: "student",
            accountStatus: "pending",
            createdAt: serverTimestamp()
        });
        status.style.color = "cyan";
        status.innerText = `Success! Registered: ${indexNo}`;
        await fetchStudents(); // Refresh list for dropdowns
    } catch (error) {
        status.innerText = "Error: Check Firestore rules.";
    }
}

async function fetchStudents() {
    const q = query(collection(firestore, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);
    allStudents = querySnapshot.docs.map(doc => ({
        uid: doc.id, 
        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
    }));
}

// 6. TABLE & UI LOGIC
function table_head() {
    const dept = document.getElementById("department").value;
    const header = document.getElementById("headerrow");
    if (!header) return;

    let cols = "<th>SELECT STUDENT</th>";
    const subjects = {
        "Preschool": "<th>LIT</th><th>NUM</th><th>ARTS</th><th>WRIT</th>",
        "LowerPrimary": "<th>ENG</th><th>MAT</th><th>SCI</th><th>TWI</th><th>HIS</th><th>RME</th><th>ART</th><th>FRE</th>",
        "UpperPrimary": "<th>ENG</th><th>MAT</th><th>SCI</th><th>COMP</th><th>TWI</th><th>HIS</th><th>RME</th><th>ART</th><th>FRE</th>",
        "JuniorHigh": "<th>ENG</th><th>MAT</th><th>SCI</th><th>COMP</th><th>TWI</th><th>SOC</th><th>RME</th><th>ART</th><th>FRE</th><th>TECH</th>"
    };

    if (subjects[dept]) cols += subjects[dept] + "<th>TOTAL</th>";
    header.innerHTML = cols;
}

function genrows() {
    const count = parseInt(document.getElementById("studentcount").value);
    const dept = document.getElementById("department").value;
    const tablebody = document.getElementById("tablebody");
    tablebody.innerHTML = "";

    const subjectMap = {
        "Preschool": ["LITERACY", "NUMERACY", "ARTS", "WRITING"],
        "LowerPrimary": ["ENGLISH", "MATHS", "SCIENCE", "TWI", "HISTORY", "RME", "ARTS", "FRENCH"],
        "UpperPrimary": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "TWI", "HISTORY", "RME", "ARTS", "FRENCH"],
        "JuniorHigh": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "TWI", "SOCIAL", "RME", "ARTS", "FRENCH", "TECH"]
    };

    const currentSubs = subjectMap[dept] || [];

    for (let i = 0; i < count; i++) {
        const tr = document.createElement("tr");
        let studentOptions = `<option value="">-- Select Student --</option>`;
        allStudents.forEach(s => {
            studentOptions += `<option value="${s.uid}">${s.name}</option>`;
        });

        let rowHTML = `<td><select class="student-select">${studentOptions}</select></td>`;
        currentSubs.forEach(sub => {
            rowHTML += `<td><input type="number" name="${sub}" class="score" oninput="calculateRowTotal(this)"></td>`;
        });
        rowHTML += `<td><input type="number" class="total-box" readonly></td>`;
        tr.innerHTML = rowHTML;
        tablebody.appendChild(tr);
    }
}

function calculateRowTotal(input) {
    const row = input.closest('tr');
    const scores = row.querySelectorAll('.score');
    let sum = 0;
    scores.forEach(s => sum += Number(s.value) || 0);
    const totalBox = row.querySelector('.total-box');
    if (totalBox) totalBox.value = sum;
}

async function saveReport() {
    const rows = document.querySelectorAll("#tablebody tr");
    const dept = document.getElementById("department").value;

    try {
        for (let row of rows) {
            const studentId = row.querySelector(".student-select").value;
            if (!studentId) continue;

            const scores = {};
            row.querySelectorAll(".score").forEach(input => {
                scores[input.name] = input.value;
            });

            await addDoc(collection(firestore, "reports"), {
                studentUid: studentId,
                department: dept,
                scores: scores,
                total: row.querySelector(".total-box").value,
                teacherUid: auth.currentUser.uid,
                timestamp: serverTimestamp()
            });
        }
        alert("Reports Saved Successfully!");
    } catch (e) {
        alert("Error saving: " + e.message);
    }
}

// 7. MENU & EXPORTS
window.toggleMenu = function() {
    const navOverlay = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    navOverlay.classList.toggle("open");
    navBtn.innerHTML = navOverlay.classList.contains("open") ? "&times;" : "&#9776;";
};

// EXPOSE TO GLOBAL (Essential for HTML onclicks)
window.table_head = table_head;
window.genrows = genrows;
window.saveReport = saveReport;
window.calculateRowTotal = calculateRowTotal;
window.registerStudent = registerStudent;

// 8. EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", genrows);
    document.getElementById("btnSave")?.addEventListener("click", saveReport);
    document.getElementById("btnRegisterStudent")?.addEventListener("click", registerStudent);
});