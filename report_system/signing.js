// 1. ALL NECESSARY IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169",
  measurementId: "G-KBTRR8YZFJ"
};

// 3. INITIALIZE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. UI FUNCTIONS (Attached to 'window' so HTML buttons can see them)

window.signin_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signin-container">
        <h3>Staff & Student Sign In</h3>
        <input type="email" placeholder="Email Address" id="email" class="email">
        <input type="password" placeholder="Password" id="password" class="pass">
        <button onclick="handlesignin()" class="signin-button">Sign In</button>
    </div>`;
};

window.signup_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signup-container">
        <h3>Create Account</h3>
        
        <select id="userRole" onchange="toggleIndexField()" class="role-select">
            <option value="student">Student Account</option>
            <option value="teacher">Teacher Account</option>
        </select>

        <div id="indexFieldWrapper">
            <p>Enter your Index Number to sync with records.</p>
            <input type="text" placeholder="Index Number" id="indexno" class="indexno">
        </div>

        <input type="text" placeholder="First Name" id="firstname" required>
        <input type="text" placeholder="Last Name" id="lastname" required>
        <input type="email" placeholder="Email" id="email" required>
        <input type="password" placeholder="Password" id="password" required>
        <input type="password" placeholder="Confirm Password" id="confirmpassword" required>
        
        <button onclick="handlesignup()" class="signup-button">Register Account</button>
    </div>`;
};

// This function handles the "Magic" of hiding/showing the Index field
window.toggleIndexField = function() {
    const role = document.getElementById('userRole').value;
    const indexWrapper = document.getElementById('indexFieldWrapper');
    
    if (role === 'teacher') {
        indexWrapper.style.display = 'none';
    } else {
        indexWrapper.style.display = 'block';
    }
};

// 5. FIREBASE LOGIC FUNCTIONS

window.handlesignin = async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "report.html"; 
    } catch (error) {
        alert("Login Error: " + error.message);
    }
};

window.handlesignup = async function() {
    const indexNo = document.getElementById('indexno').value.trim();
    const fname = document.getElementById('firstname').value.trim();
    const lname = document.getElementById('lastname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmpassword').value;

    if (password !== confirm) return alert("Passwords do not match!");

    try {
        // Step A: Create the Login account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step B: THE SYNC - Look for the Index Number the teacher added
        const userRef = doc(db, "users", indexNo);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            // Found it! Link the new account to the teacher's data
            await updateDoc(userRef, {
                uid: user.uid,
                email: email,
                firstName: fname,
                lastName: lname,
                accountStatus: "active"
            });
            alert("Success! Your account is linked to your school records.");
        } else {
            // No record found: Create a fresh profile
            await setDoc(doc(db, "users", user.uid), {
                indexNo: indexNo,
                firstName: fname,
                lastName: lname,
                email: email,
                role: "student",
                accountStatus: "active"
            });
            alert("Account created! (No existing teacher record found).");
        }
        window.location.href = "report.html";
    } catch (error) {
        alert("Signup Error: " + error.message);
    }
};