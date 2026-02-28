import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let currentTeacherUid = null;

// Track Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentTeacherUid = user.uid;
    } else {
        window.location.href = "index.html"; // Redirect if not logged in
    }
});

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
        <th>Ex. (15)</th>
        <th>Test (15)</th>
        <th>Proj. (15)</th>
        <th>Group (15)</th>
        <th>Total (60)</th>
        <th>Scale (50)</th>
        <th>Action</th>
    `;

    tableBody.innerHTML = "";
    for (let i = 0; i < studentCount; i++) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="text" placeholder="Name" class="student-name"></td>
            <td><input type="number" class="class-exercise" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="class-test" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="project-work" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="group-work" oninput="calculate(this)" max="15"></td>
            <td><input type="number" class="total-score" readonly></td>
            <td><input type="text" class="scale-score" readonly></td>
            <td><button class="save-row-btn" onclick="saveSingleRow(this)">Save</button></td>
        `;
        tableBody.appendChild(row);
    }
};

// --- 4. CALCULATIONS ---
window.calculate = function(element) {
    const row = element.closest('tr');
    const getVal = (cls) => parseFloat(row.querySelector(cls).value) || 0;

    const total = getVal('.class-exercise') + getVal('.class-test') + 
                  getVal('.project-work') + getVal('.group-work');
    
    const scale = (total / 60) * 50;

    row.querySelector('.total-score').value = total.toFixed(1);
    row.querySelector('.scale-score').value = scale.toFixed(1);
};

// --- 5. SAVE FOR A STUDENT ---
window.saveSingleRow = async function(button) {
    const row = button.closest('tr');
    const dept = document.getElementById("category").value;
    const subject = document.getElementById("subjects").value;
    const studentName = row.querySelector('.student-name').value;

    if (!studentName || !subject || dept === "Choose_A_Department") {
        alert("Please ensure Department, Subject, and Student Name are filled!");
        return;
    }

    button.disabled = true;
    button.innerText = "...";

    try {
        await addDoc(collection(firestore, "assessments"), {
            teacherUid: currentTeacherUid,
            studentName: studentName,
            department: dept,
            subject: subject,
            scores: {
                exercise: row.querySelector('.class-exercise').value || 0,
                test: row.querySelector('.class-test').value || 0,
                project: row.querySelector('.project-work').value || 0,
                group: row.querySelector('.group-work').value || 0
            },
            total60: row.querySelector('.total-score').value,
            scaled50: row.querySelector('.scale-score').value,
            timestamp: serverTimestamp()
        });

        button.innerText = "Saved";
        button.style.backgroundColor = "#00ff88";
    } catch (e) {
        console.error("Error saving: ", e);
        alert("Save failed. Check console.");
        button.disabled = false;
        button.innerText = "Save";
    }
};

window.toggleMenu = function() {
    const nav = document.getElementById("navover");
    if (nav) nav.classList.toggle("open");
};