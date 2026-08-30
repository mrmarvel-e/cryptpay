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


    try {

        const response =
            await fetch("/register", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    name: name,

                    email: email,

                    username: username,

                    password: password

                })

            });


        const result =
            await response.json();


        if (result.success) {

            // Registration successful.
            // The server already logs the user in.

            window.location.href =
                "cryptpay.html";

        }

        else {

            document.getElementById(
                "message"
            ).textContent =
                result.message ||
                "Registration failed.";

        }

    }

    catch (error) {

        console.error(
            "Registration error:",
            error
        );

        document.getElementById(
            "message"
        ).textContent =
            "Unable to create account. Please try again.";

    }

});
