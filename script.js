const form = document.getElementById("registerForm");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const name =
        document.getElementById("name").value;

    const email =
        document.getElementById("email").value;

    const username =
        document.getElementById("username").value;

    const password =
        document.getElementById("password").value;


    const response = await fetch("/register", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            name,
            email,
            username,
            password
        })

    });


    const result =
        await response.json();


    if (result.success) {

        window.location.href =
            "cryptpay.html";

    } else {

        document.getElementById("message").textContent =
            result.message;

    }

});