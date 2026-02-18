function signin_page(){
    const signinpage = document.getElementById("signin");
    const sign = document.getElementById("signingpage");
    sign.innerHTML=`
    <div class="signin-container">
    <textarea type="text" placeholder="User's email" id="email" class="email"></textarea>
    <textarea type="password" placeholder="Password" id="password" class="pass"></textarea>
    <button onclick="handlesignin()" class="signin-button">Sign In</button>
    </div>
    `
}
function signup_page(){
    const signuppage= document.getElementById("signup");
    const sign = document.getElementById("signingpage");
    sign.innerHTML=`
    <div class="signup-container">
    <textarea type="text" placeholder="User's first name" id="firstname" class="firstname"></textarea>
    <textarea type="text" placeholder="User's last name" id="lastname" class="lastname"></textarea>
    <textarea type="text" placeholder="User's email" id="email" class="email"></textarea>
    <p>
    Create a strong password
    Note: Password must be at least 8 characters long and contain at least one uppercase letter, 
    one lowercase letter, and one number.</p>
    <textarea type="password" placeholder="Password" id="password" class="pass"></textarea>
    <textarea type="password" placeholder="Confirm Password" id="confirmpassword" class="confirmpass"></textarea>
    <button onclick="handlesignup()" class="signup-button">Sign Up</button>
    </div>
    `
}
async function handlesignin(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const hashedpassword= "3234169073352811b227d739a37aace2888d407707519a8107af5de24bdcba44";
    const Shaapi = new TextEncoder().encode(password);
    const buffer = await crypto.subtle.digest("SHA-256", Shaapi);
        const hashArray = Array.from(new Uint8Array(buffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    if(email === "nanabenyin57@gmail.com" && hashHex === hashedpassword){
        window.location.href = "report.html";
    }
    else{
        alert("Invalid email or password. Please try again.");
    }
}
function handlesignup(){
    const firstname = document.getElementById("firstname").value;      
    const lastname = document.getElementById("lastname").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmpassword = document.getElementById("confirmpassword").value;
    if(password !== confirmpassword){
        alert("Passwords do not match. Please try again.");
    }   
    else if(password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)){
        alert("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.");
    }   
    else{
        window.location.href = "report.html";
    }
}