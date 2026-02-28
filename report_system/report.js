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

let allStudents = []; // Global list to hold student data

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
                    statusMsg.innerText = `Welcome, ${userData.firstName} (Admin)`;
                    
                    // NEW: Fetch all students so we can populate the dropdowns later
                    const q = query(collection(firestore, "users"), where("role", "==", "student"));
                    const querySnapshot = await getDocs(q);
                    allStudents = querySnapshot.docs.map(doc => ({
                        uid: doc.id,
                        name: `${doc.data().firstName} ${doc.data().lastName}`
                    }));
                } else {
    // This matches your folder structure in the screenshot
    window.location.href = "student_report.html"; 
                }
            }
        } catch (error) { console.error("Auth error:", error); }
    } else { window.location.href = "index.html"; }
});

// 5. UI GENERATION
function table_head() {
    const dept = document.getElementById("department").value;
    const header = document.getElementById("headerrow");
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
        
        // Create Student Dropdown
        let studentOptions = `<option value="">-- Select Student --</option>`;
        allStudents.forEach(s => {
            studentOptions += `<option value="${s.uid}">${s.name}</option>`;
        });

        let rowHTML = `<td><select class="student-select" required>${studentOptions}</select></td>`;
        
        currentSubs.forEach(sub => {
            rowHTML += `<td><input type="number" name="${sub}" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required></td>`;
        });
        
        rowHTML += `<td><input type="number" class="total-box" readonly></td>`;
        tr.innerHTML = rowHTML;
        tablebody.appendChild(tr);
    }
}

// 6. CALCULATIONS
function calculateRowTotal(input) {
    const row = input.closest('tr');
    const scores = row.querySelectorAll('.score');
    let sum = 0;
    scores.forEach(s => sum += Number(s.value) || 0);
    row.querySelector('.total-box').value = sum;
}

// 7. SAVE TO FIRESTORE (Individual UID Linking)
async function saveReport() {
    const dept = document.getElementById("department").value;
    const rows = document.querySelectorAll("#tablebody tr");
    const statusMsg = document.getElementById("status-msg");

    if (dept === "choose_a_department" || rows.length === 0) {
        alert("Please generate rows first!");
        return;
    }

    try {
        statusMsg.innerText = "Syncing with K_Tawiah Cloud...";
        
        // Loop through each row to save a unique document for each student
        for (let row of rows) {
            const studentDropdown = row.querySelector(".student-select");
            const studentUid = studentDropdown.value; // This is the UID from the <option>
            const studentName = studentDropdown.options[studentDropdown.selectedIndex].text;
            
            if (!studentUid) continue; // Skip if no student was selected

            const grades = {};
            row.querySelectorAll(".score").forEach(input => {
                grades[input.name] = input.value || "0";
            });

            // This creates a NEW document for EACH student
            await addDoc(collection(firestore, "reports"), {
                studentUid: studentUid,     // The "Key" that links to the student
                studentName: studentName,   // Saved for display purposes
                teacherUid: auth.currentUser.uid,
                department: dept,
                scores: grades,
                total: row.querySelector(".total-box").value,
                timestamp: serverTimestamp(),
                date: new Date().toLocaleDateString()
            });
        }

        statusMsg.innerText = "All Student Results Linked & Saved!";
        alert("Success! Each student's report is now linked to their UID.");
    } catch (error) {
        console.error("Firestore Linking Error:", error);
        statusMsg.innerText = "Error: Check Firestore Rules";
    }
}

// 8. BRIDGE
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", genrows);
    document.getElementById("btnSave")?.addEventListener("click", saveReport);
});

window.table_head = table_head;
window.calculateRowTotal = calculateRowTotal;