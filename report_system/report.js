// 1. CLEAN IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, getDocs, collection, query, where, addDoc, serverTimestamp 
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

let allStudents = []; // Global list to hold student data for the dropdowns

// 4. AUTH & STUDENT FETCH
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
                    
                    // Fetch all students to populate dropdowns
                    const q = query(collection(firestore, "users"), where("role", "==", "student"));
                    const querySnapshot = await getDocs(q);
                    allStudents = querySnapshot.docs.map(doc => ({
                        uid: doc.id,
                        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
                    }));
                } else {
                    // Redirect students to their specific view
                    window.location.href = "student_report.html"; 
                }
            }
        } catch (error) { 
            console.error("Auth error:", error); 
            if (statusMsg) statusMsg.innerText = "Permission Denied: Update Firestore Rules.";
        }
    } else { 
        window.location.href = "index.html"; 
    }
});

// 5. UI GENERATION
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
    const countInput = document.getElementById("studentcount");
    const deptSelect = document.getElementById("department");
    const tablebody = document.getElementById("tablebody");
    
    if (!countInput || !deptSelect || !tablebody) return;

    const count = parseInt(countInput.value);
    const dept = deptSelect.value;
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

        let rowHTML = `<td><select class="student-select" style="width:100%" required>${studentOptions}</select></td>`;
        
        currentSubs.forEach(sub => {
            rowHTML += `<td><input type="number" name="${sub}" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required></td>`;
        });
        
        rowHTML += `<td><input type="number" class="total-box" readonly></td>`;
        tr.innerHTML = rowHTML;
        tablebody.appendChild(tr);
    }
}

// 6. CALCULATIONS & TOGGLE
function calculateRowTotal(input) {
    const row = input.closest('tr');
    const scores = row.querySelectorAll('.score');
    let sum = 0;
    scores.forEach(s => sum += Number(s.value) || 0);
    const totalBox = row.querySelector('.total-box');
    if (totalBox) totalBox.value = sum;
}

function toggleMenu() {
    const navOver = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    if (navOver && navBtn) {
        navOver.classList.toggle("open");
        navBtn.classList.toggle("is-active");
    }
}
window.toggleMenu = toggleMenu; // Expose to global for onclick
// 7. SAVE TO FIRESTORE (UID Linked)
async function saveReport() {
    const dept = document.getElementById("department").value;
    const rows = document.querySelectorAll("#tablebody tr");
    const statusMsg = document.getElementById("status-msg");

    if (dept === "choose_a_department" || rows.length === 0) {
        alert("Setup the table and select students first!");
        return;
    }

    try {
        statusMsg.innerText = "Uploading to K_Tawiah Cloud...";
        
        for (let row of rows) {
            const studentDropdown = row.querySelector(".student-select");
            const studentUid = studentDropdown.value;
            const studentName = studentDropdown.options[studentDropdown.selectedIndex].text;
            
            if (!studentUid) continue; // Safety skip

            const grades = {};
            row.querySelectorAll(".score").forEach(input => {
                grades[input.name] = input.value || "0";
            });

            await addDoc(collection(firestore, "reports"), {
                studentUid: studentUid,
                studentName: studentName,
                teacherUid: auth.currentUser.uid,
                department: dept,
                scores: grades,
                total: row.querySelector(".total-box").value,
                timestamp: serverTimestamp(),
                date: new Date().toLocaleDateString()
            });
        }

        statusMsg.innerText = "All Student Results Saved!";
        alert("Success! Students can now view their individual reports.");
    } catch (error) {
        console.error("Save Error:", error);
        statusMsg.innerText = "Permission Denied. Check Firestore Rules.";
    }
}

// 8. EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", genrows);
    document.getElementById("btnSave")?.addEventListener("click", saveReport);
});

// 9. GLOBAL EXPOSURE (Fixes the Toggle & Dropdown issues)
window.table_head = table_head;
window.genrows = genrows;

window.calculateRowTotal = calculateRowTotal;
window.saveReport = saveReport;