const form = document.getElementById("loginForm");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const username =
        document.getElementById("username").value;

    const password =
        document.getElementById("password").value;


    const response = await fetch("/login", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            username,
            password
        })

    });


    const result = await response.json();


    if (result.success) {

        // Login successful
        window.location.href = "cryptpay.html";

    } else {

        document.getElementById("message")
            .textContent = result.message;

    }

});