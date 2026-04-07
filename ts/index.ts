import Measurement from "./object/Measurement.ts";

const measures: Measurement[] = [];

// Deno.serve({ port: 8000, hostname: "0.0.0.0" }, req => {
//     const { pathname } = new URL(req.url);

//     if (pathname === "/") {
//         return new Response(Deno.readTextFileSync(""))
//     }
// })

// Deno.serve({ port: 8000, hostname: "0.0.0.0" }, req => {
//     const { pathname } = new URL(req.url);

//     if (pathname === "/") { // Index/homepage

//     } else {
//         return new Response("400", {
//             status: 404
//         })
//     }
//     return new Response(); // Temp line
// });

/**
 * @param {Measurement} m
 */
function logMeasurement(m: Measurement) {
    console.log("Tms:\t", m.ts);
    console.log("Cel:\t", m.celsius);
    console.log("XYZ:\t", ...m.XYZ);
    console.log("HEZ:\t", ...m.HEZ);
    console.log("Mag:\t", m.XYZ.magnitude);
    console.log("----------------------------------");
}
