import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- 1. FIREBASE CONFIG (Add yours here) ---
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169"
};
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// --- 2. DYNAMIC SUBJECT POPULATION ---
window.departmentchange = function() {
    const category = document.getElementById("category").value;
    const subjects = document.getElementById("subjects");
    
    subjects.innerHTML = '<option value="">-- Choose Subject --</option>';

    const subjectData = {
        "Preschool": ["Numeracy", "Literacy", "Creative Arts", "Our World"],
        "LowerPrimary": ["English", "Maths", "Science", "History", "Our World", "RME", "Twi"],
        "UpperPrimary": ["English", "Maths", "Science", "History", "Computing", "RME", "Twi"],
        "JuniorHigh": ["English", "Maths", "Science", "Social Studies", "Computing", "Pre-Tech", "RME", "Twi"]
    };

    if (subjectData[category]) {
        subjectData[category].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            subjects.appendChild(el);
        });
    }
};

// --- 3. TABLE ROW GENERATION ---
window.SBA = function() {
    const studentCount = document.getElementById("studentcount").value;
    const tableHeader = document.getElementById("assessment_headerrow");
    const tableBody = document.getElementById("assessment_tablebody");

    tableHeader.innerHTML = `
        <th>Student Name</th>
        <th>Exercise (15)</th>
        <th>Test (15)</th>
        <th>Project (15)</th>
        <th>Group (15)</th>
        <th>Total (60)</th>
        <th>Scale (50)</th>
    `;

    tableBody.innerHTML = "";
    for (let i = 0; i < studentCount; i++) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="text" placeholder="Enter Name" class="student-name"></td>
            <td><input type="number" class="class-exercise" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="class-test" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="project-work" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="group-work" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="total-score" readonly></td>
            <td><input type="text" class="scale-score" readonly></td>
        `;
        tableBody.appendChild(row);
    }
};

// --- 4. CALCULATIONS (Total & Scale) ---
window.calculate = function(element) {
    const row = element.closest('tr');
    
    const exercise = parseFloat(row.querySelector('.class-exercise').value) || 0;
    const test = parseFloat(row.querySelector('.class-test').value) || 0;
    const project = parseFloat(row.querySelector('.project-work').value) || 0;
    const group = parseFloat(row.querySelector('.group-work').value) || 0;

    const total = exercise + test + project + group;
    // Scaling formula: (Total / 60) * 50
    const scale = (total / 60) * 50;

    row.querySelector('.total-score').value = total.toFixed(1);
    row.querySelector('.scale-score').value = scale.toFixed(1);
};

// --- 5. TOGGLE MENU ---
window.toggleMenu = function() {
    const nav = document.getElementById("navover");
    if (nav) nav.classList.toggle("open");
};