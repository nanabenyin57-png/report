// 1. IMPORTS - Use consistent versions (11.0.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

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
const firestore = getFirestore(app); // For user roles
const rtdb = getDatabase(app);      // For student reports

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
                console.log(`Welcome, ${userName}. Role: ${userData.role}`);

                if (userData.role === "admin" || userData.role === "teacher") {
                    if (adminSec) adminSec.style.display = "block";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Admin Access)`;
                } else {
                    if (adminSec) adminSec.style.display = "none";
                    if (statusMsg) statusMsg.innerText = `Welcome, ${userName} (Student View)`;
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
    row.querySelector('.total-box').value = sum;
}

// 7. DATABASE FUNCTIONS
window.saveReport = async function() {
    const department = document.getElementById("department").value;
    const tableBody = document.getElementById("tablebody");
    const rows = tableBody.querySelectorAll("tr");
    const statusMsg = document.getElementById("status-msg");

    if (department === "choose_a_department" || rows.length === 0) {
        alert("Please select a department and generate rows.");
        return;
    }

    const reportData = {};
    rows.forEach((row, index) => {
        const nameInput = row.querySelector(".student-name");
        const studentKey = nameInput.value.trim().replace(/[.#$\[\]]/g, "_") || `Student_${index + 1}`;
        const studentGrades = {};

        row.querySelectorAll(".score").forEach(input => {
            studentGrades[input.name] = input.value;
        });
        studentGrades["TOTAL"] = row.querySelector(".total-box").value;
        reportData[studentKey] = studentGrades;
    });

    try {
        statusMsg.innerText = "Uploading to K_Tawiah Cloud...";
        const timestamp = new Date().getTime(); // Use numbers for cleaner paths
        const reportRef = ref(rtdb, `reports/${department}/${timestamp}`);

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
        statusMsg.innerText = "Error: Check Console";
    }
};

async function viewMyReport(studentName) {
    const department = document.getElementById("department").value;
    const dbRef = ref(rtdb);

    try {
        const snapshot = await get(child(dbRef, `reports/${department}`));
        if (snapshot.exists()) {
            console.log("Found reports:", snapshot.val());
            // Logical lookup code would go here
        }
    } catch (error) {
        console.error("Error fetching:", error);
    }
}

// 8. EXPORT TO WINDOW (For HTML access)
window.genrows = genrows;
window.table_head = table_head;
window.calculateRowTotal = calculateRowTotal;
window.saveReport = saveReport;

console.log("K_Tawiah System: Online");