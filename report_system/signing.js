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
    <h1>
    Create a strong password
    Note: Password must be at least 8 characters long and contain at least one uppercase letter, 
    one lowercase letter, and one number.</h1>
    <textarea type="password" placeholder="Password" id="password" class="pass"></textarea>
    <textarea type="password" placeholder="Confirm Password" id="confirmpassword" class="confirmpass"></textarea>
    <button onclick="handlesignup()" class="signup-button">Sign Up</button>
    </div>
    `
}