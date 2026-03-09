// 1. UPDATE IMPORTS (Added setDoc)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ... (Keep existing config and initialization)

// NEW: REGISTRATION LOGIC
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
        
        // We use setDoc with indexNo as the ID. 
        // This is the "Middle Man" record the student will search for during signup.
        await setDoc(doc(firestore, "users", indexNo), {
            firstName: fname,
            lastName: lname,
            indexNo: indexNo,
            role: "student",
            accountStatus: "pending", // Changes to 'active' when student signs up
            createdAt: serverTimestamp()
        });

        status.style.color = "green";
        status.innerText = `Success! ${fname} registered with ID: ${indexNo}`;
        
        // Clear inputs
        document.getElementById("reg-index").value = "";
        document.getElementById("reg-fname").value = "";
        document.getElementById("reg-lname").value = "";

        // Refresh the student list so they appear in the dropdown immediately
        fetchStudents(); 
    } catch (error) {
        console.error("Reg Error:", error);
        status.style.color = "red";
        status.innerText = "Error: Check Firestore rules.";
    }
}

// HELPER: Refactor student fetching into a function so we can call it after registration
async function fetchStudents() {
    const q = query(collection(firestore, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);
    allStudents = querySnapshot.docs.map(doc => ({
        // Use document ID (IndexNo) or the UID if they've signed up already
        uid: doc.id, 
        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
    }));
}

// UPDATE AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        if (userDoc.exists() && (userDoc.data().role === "admin" || userDoc.data().role === "teacher")) {
            if (adminSec) adminSec.style.display = "block";
            statusMsg.innerText = `Welcome, ${userDoc.data().firstName} (Staff)`;
            await fetchStudents(); // Load existing students
        } else {
            window.location.href = "student_report.html"; 
        }
    } else { 
        window.location.href = "index.html"; 
    }
});

// ... (Keep existing table_head, genrows, calculateRowTotal, toggleMenu, saveReport)

// UPDATE EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", genrows);
    document.getElementById("btnSave")?.addEventListener("click", saveReport);
    document.getElementById("btnRegisterStudent")?.addEventListener("click", registerStudent);
});

// GLOBAL EXPOSURE
window.table_head = table_head;
window.genrows = genrows;
window.calculateRowTotal = calculateRowTotal;
window.saveReport = saveReport;
window.registerStudent = registerStudent;