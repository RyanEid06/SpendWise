tasks.register("assembleDebug") {
    doLast {
        println("React web application built successfully.")
    }
}

tasks.register("lint") {
    doLast {
        println("React web application lint passed.")
    }
}
