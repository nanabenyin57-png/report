import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- 1. FIREBASE SETUP ---
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

let allStudents = [];

// --- 2. AUTH & STUDENT FETCH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch students to populate the rows later
        const q = query(collection(firestore, "users"), where("role", "==", "student"));
        const querySnapshot = await getDocs(q);
        allStudents = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
        }));
    } else {
        window.location.href = "index.html";
    }
});

// --- 3. DYNAMIC SUBJECTS ---
window.departmentchange = function() {
    const dept = document.getElementById("category").value;
    const subjectSelect = document.getElementById("subjects");
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';

    const subjects = {
        "Preschool": ["Numeracy", "Literacy", "Creative Arts", "Our World"],
        "LowerPrimary": ["English", "Maths", "Science", "History", "Our World", "RME", "Twi"],
        "UpperPrimary": ["English", "Maths", "Science", "History", "Computing", "RME", "Twi"],
        "JuniorHigh": ["English", "Maths", "Science", "Social Studies", "Computing", "Pre-Tech", "Home Ec", "RME", "Twi"]
    };

    if (subjects[dept]) {
        subjects[dept].forEach(sub => {
            let opt = document.createElement("option");
            opt.value = sub;
            opt.innerText = sub;
            subjectSelect.appendChild(opt);
        });
    }
};

// --- 4. TABLE GENERATION ---
window.SBA = function() {
    const count = document.getElementById("studentcount").value;
    const header = document.getElementById("assessment_headerrow");
    const body = document.getElementById("assessment_tablebody");

    // Create Header
    header.innerHTML = `
        <th>Student Name</th>
        <th>Class Score (50)</th>
        <th>Exams Score (50)</th>
        <th>Total (100)</th>
        <th>Grade</th>
    `;

    // Create Rows
    body.innerHTML = "";
    for (let i = 0; i < count; i++) {
        let studentOptions = allStudents.map(s => `<option value="${s.uid}">${s.name}</option>`).join('');
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <select class="student-uid-select">${studentOptions}</select>
            </td>
            <td><input type="number" class="c-score" oninput="calculateSBA(this)" max="50"></td>
            <td><input type="number" class="e-score" oninput="calculateSBA(this)" max="50"></td>
            <td><input type="number" class="t-score" readonly></td>
            <td><input type="text" class="g-score" readonly style="width:50px; text-align:center;"></td>
        `;
        body.appendChild(tr);
    }
};

// --- 5. CALCULATIONS ---
window.calculateSBA = function(input) {
    const row = input.closest('tr');
    const classScore = parseFloat(row.querySelector('.c-score').value) || 0;
    const examScore = parseFloat(row.querySelector('.e-score').value) || 0;
    const total = classScore + examScore;
    
    const totalField = row.querySelector('.t-score');
    const gradeField = row.querySelector('.g-score');
    
    totalField.value = total;

    // Ghanaian Grading System Example
    if (total >= 80) gradeField.value = "1";
    else if (total >= 70) gradeField.value = "2";
    else if (total >= 60) gradeField.value = "3";
    else if (total >= 50) gradeField.value = "4";
    else gradeField.value = "9";
};

// --- 6. UI TOGGLE ---
window.toggleMenu = function() {
    document.getElementById("navover").classList.toggle("open");
};