// 1. CLEAN IMPORTS (No Realtime Database here)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 2. CONFIG (Simplified)
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
const firestore = getFirestore(app); // Only Firestore!

// 4. AUTH & ROLE CHECK
onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userName = userData.firstName || userData.firstname || "User";
                
                if (userData.role === "admin" || userData.role === "teacher") {
                    if (adminSec) adminSec.style.display = "block";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Admin Access)`;
                } else {
                    if (adminSec) adminSec.style.display = "none";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Student View)`;
                }
            }
        } catch (error) {
            console.error("Auth error:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// 5. UI GENERATION FUNCTIONS
function table_head() {
    const deptSelect = document.getElementById("department");
    const header = document.getElementById("headerrow");
    if (!deptSelect || !header) return;

    const tablehead = deptSelect.value;
    let col1 = "<th>STUDENT NAME</th>";

    const subjectHeaders = {
        "Preschool": "<th>LITERACY</th><th>NUMERACY</th><th>CREATIVE ARTS</th><th>WRITING</th>",
        "LowerPrimary": "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th>",
        "UpperPrimary": "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th>",
        "JuniorHigh": "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>SOCIAL STUDIES</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th><th>CAREER TECH</th>"
    };

    if (subjectHeaders[tablehead]) {
        col1 += subjectHeaders[tablehead] + "<th>TOTAL</th>";
    } else {
        col1 = "<th>Please Select A Department</th>";
    }
    header.innerHTML = col1;
}

function genrows() {
    const countInput = document.getElementById("studentcount");
    const deptSelect = document.getElementById("department");
    const tablebody = document.getElementById("tablebody");
    
    if (!countInput || !deptSelect || !tablebody) return;

    const count = parseInt(countInput.value);
    const dept = deptSelect.value;
    tablebody.innerHTML = "";

    const subjects = {
        "Preschool": ["LITERACY", "NUMERACY", "CREATIVE_ARTS", "WRITING"],
        "LowerPrimary": ["ENGLISH", "MATHS", "SCIENCE", "HISTORY", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI"],
        "UpperPrimary": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "HISTORY", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI"],
        "JuniorHigh": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "SOCIAL_STUDIES", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI", "CAREER_TECH"]
    };

    const currentSubjects = subjects[dept] || [];

    for (let i = 0; i < count; i++) {
        let rowcontent = `<td><input type="text" class="student-name" placeholder="Name" required></td>`;
        currentSubjects.forEach(sub => {
            rowcontent += `<td><input type="number" name="${sub}" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required></td>`;
        });
        rowcontent += `<td><input type="number" class="total-box" readonly></td>`;
        const tr = document.createElement("tr");
        tr.innerHTML = rowcontent;
        tablebody.appendChild(tr);
    }
}

// 6. UTILITY FUNCTIONS
function calculateRowTotal(input) {
    const row = input.closest('tr');
    const scores = row.querySelectorAll('.score');
    let sum = 0;
    scores.forEach(score => {
        sum += Number(score.value) || 0;
    });
    const totalBox = row.querySelector('.total-box');
    if (totalBox) totalBox.value = sum;
}

function downloadCSV() {
    const rows = document.querySelectorAll("table tr");
    let csvContent = "";
    rows.forEach(row => {
        const cols = row.querySelectorAll("td, th");
        let rowData = Array.from(cols).map(col => {
            const input = col.querySelector("input");
            return input ? input.value : col.innerText;
        });
        csvContent += rowData.join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_report.csv";
    a.click();
}

function toggleMenu() {
    document.getElementById("navover")?.classList.toggle("open");
    document.getElementById("navigation")?.classList.toggle("is-active");
}

// 7. SAVE TO FIRESTORE
async function saveReport() {
    const department = document.getElementById("department").value;
    const tableBody = document.getElementById("tablebody");
    const rows = tableBody.querySelectorAll("tr");
    const statusMsg = document.getElementById("status-msg");

    if (department === "choose_a_department" || rows.length === 0) {
        alert("Please select a department and generate rows.");
        return;
    }

    const reportEntries = [];
    rows.forEach((row) => {
        const nameInput = row.querySelector(".student-name");
        const studentGrades = {
            studentName: nameInput.value.trim() || "Unknown"
        };
        row.querySelectorAll(".score").forEach(input => {
            studentGrades[input.name] = input.value;
        });
        studentGrades["TOTAL"] = row.querySelector(".total-box").value;
        reportEntries.push(studentGrades);
    });

    try {
        statusMsg.innerText = "Syncing with K_Tawiah Cloud...";
        // This saves to the "reports" collection in Firestore
        await addDoc(collection(firestore, "reports"), {
            department: department,
            timestamp: serverTimestamp(),
            studentCount: rows.length,
            scores: reportEntries,
            date: new Date().toLocaleDateString()
        });

        statusMsg.innerText = "Data Saved Successfully!";
        alert("Report saved to Cloud!");
    } catch (error) {
        console.error("Firestore Save Error:", error);
        statusMsg.innerText = "Error: Check Firestore Rules";
    }
}

// 8. BRIDGE: EVENT LISTENERS & ENTER KEY
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", genrows);
    document.getElementById("btnSave")?.addEventListener("click", saveReport);
    document.getElementById("btnDownload")?.addEventListener("click", downloadCSV);

    // Dynamic Enter Key Navigation
    const tableBody = document.getElementById("tablebody");
    if (tableBody) {
        tableBody.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
                const allInputs = Array.from(tableBody.querySelectorAll('input:not([readonly])'));
                const currentIndex = allInputs.indexOf(e.target);
                const nextInput = allInputs[currentIndex + 1];

                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        });
    }
});

// 9. GLOBAL EXPOSURE
window.table_head = table_head;
window.toggleMenu = toggleMenu;
window.calculateRowTotal = calculateRowTotal;