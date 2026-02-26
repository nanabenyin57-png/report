// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
window.auth = getAuth(app);
window.db = getFirestore(app);

// 4. AUTH & ROLE CHECK
onAuthStateChanged(window.auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        try {
            const userDoc = await getDoc(doc(window.db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Fix: Check both case-sensitive versions of name
                const userName = userData.firstName || userData.firstname || "User";
                console.log(`Welcome, ${userName}. Role: ${userData.role}`);

                if (userData.role === "admin" || userData.role === "teacher") {
                    if (adminSec) adminSec.style.display = "block";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Admin Access)`;
                } else {
                    if (adminSec) adminSec.style.display = "none";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Student View)`;
                    // loadStudentGrades(user.uid); // Future student function
                }
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
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

    if (tablehead === "Preschool") {
        col1 += "<th>LITERACY</th><th>NUMERACY</th><th>CREATIVE ARTS</th><th>WRITING</th><th>TOTAL</th>";
    } else if (tablehead === "LowerPrimary") {
        col1 += "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th><th>TOTAL</th>";
    } else if (tablehead === "UpperPrimary") {
        col1 += "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th><th>TOTAL</th>";
    } else if (tablehead === "JuniorHigh") {
        col1 += "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>SOCIAL STUDIES</th><th>RELIGIOUS ED</th><th>CREATIVE ARTS</th><th>FRENCH</th><th>CAREER TECH</th><th>TOTAL</th>";
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

    const count = countInput.value;
    const dept = deptSelect.value;
    tablebody.innerHTML = "";

    for (let i = 0; i < count; i++) {
        let rowcontent = `<td><input type="text" name="STUDENT_NAME[]" placeholder="Name" required></td>`;
        
        // Helper to generate score inputs based on department
        const subjects = {
            "Preschool": ["LITERACY", "NUMERACY", "CREATIVE_ARTS", "WRITING"],
            "LowerPrimary": ["ENGLISH", "MATHS", "SCIENCE", "HISTORY", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI"],
            "UpperPrimary": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "HISTORY", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI"],
            "JuniorHigh": ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "SOCIAL_STUDIES", "CREATIVE_ARTS", "FRENCH", "RELIGIOUS_ED", "TWI", "CAREER_TECH"]
        };

        const currentSubjects = subjects[dept] || [];
        currentSubjects.forEach(sub => {
            rowcontent += `<td><input type="number" name="${sub}[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required></td>`;
        });

        rowcontent += `<td><input type="number" name="TOTAL_SCORE[]" class="total-box" readonly></td>`;
        tablebody.innerHTML += `<tr>${rowcontent}</tr>`;
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
    row.querySelector('.total-box').value = sum;
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
    URL.revokeObjectURL(url);
}

function toggleMenu() {
    document.getElementById("navover")?.classList.toggle("open");
    document.getElementById("navigation")?.classList.toggle("is-active");
}
// This is to ensure that the student data is saved to firebase in a structured way, with metadata for easy retrieval and analysis later on. The function also includes error handling to manage potential issues during the save process.

window.saveReport = async function() {
    const db = getDatabase(); // Get your initialized database
    const department = document.getElementById("department").value;
    const tableBody = document.getElementById("tablebody");
    const rows = tableBody.querySelectorAll("tr");
    const statusMsg = document.getElementById("status-msg");

    // 1. Validation
    if (department === "choose_a_department") {
        alert("Please select a department before saving.");
        return;
    }

    // 2. Transform Table Rows into a Key-Value Object
    const reportData = {};
    
    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll("input");
        if (inputs.length > 0) {
            // We assume the first input is the Student Name or ID
            const studentKey = inputs[0].value.trim() || `Student_${index + 1}`;
            const studentGrades = {};

            inputs.forEach(input => {
                if (input.name) {
                    studentGrades[input.name] = input.value;
                }
            });

            // Map the grades to that specific student's name
            reportData[studentKey] = studentGrades;
        }
    });

    try {
        statusMsg.innerText = "Uploading to K_Tawiah Cloud...";
        
        // 3. Define the path: reports > Department > Timestamp
        // This keeps your data organized by date
        const timestamp = new Date().toISOString().replace(/[.#$\[\]]/g, "_"); 
        const reportRef = ref(db, `reports/${department}/${timestamp}`);

        // 4. Save to Firebase
        await set(reportRef, {
            metadata: {
                studentCount: rows.length,
                date: new Date().toLocaleDateString(),
                department: department
            },
            scores: reportData
        });

        statusMsg.innerText = "Data Synced Successfully!";
        alert("Report saved to Firebase!");

    } catch (error) {
        console.error("Firebase Save Error:", error);
        statusMsg.innerText = "Error: Check Internet Connection";
        alert("Failed to save. Please try again.");
    }
};
async function viewMyReport(studentName) {
    const dbRef = ref(getDatabase());
    // We search under the department the student belongs to
    const studentDept = "JuniorHigh"; 

    try {
        const snapshot = await get(child(dbRef, `reports/${studentDept}`));
        if (snapshot.exists()) {
            const allReports = snapshot.val();
            
            // Look through all timestamps to find this student
            for (let timestamp in allReports) {
                const report = allReports[timestamp].scores;
                if (report[studentName]) {
                    displayGrades(report[studentName]); // Show grades on screen
                    return;
                }
            }
            alert("Report not found yet.");
        }
    } catch (error) {
        console.error("Error fetching student report:", error);
    }
}

// 7. KEYBOARD NAVIGATION (Excel Style)
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('input:not([readonly])'));
        const nextIndex = allInputs.indexOf(e.target) + 1;
        if (allInputs[nextIndex]) {
            allInputs[nextIndex].focus();
            allInputs[nextIndex].select();
        }
    }
}, true);

// 8. GLOBAL EXPOSURE
window.genrows = genrows;
window.table_head = table_head;
window.toggleMenu = toggleMenu;
window.downloadCSV = downloadCSV;
window.calculateRowTotal = calculateRowTotal;
window.saveReport = saveReport;

console.log("Report script refined and ready.");