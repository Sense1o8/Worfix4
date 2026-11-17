const { chromium } = require("playwright");
const S = process.env.SHOT_DIR || "/tmp";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}
async function logout(page) {
  await page.evaluate(() => localStorage.removeItem("worfix.dev.session"));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // 1. Landing + public pages
  await page.goto(BASE);
  check("landing renders hero", await page.getByRole("heading", { level: 1 }).first().isVisible());
  await page.getByText("Missions open now").waitFor();
  await page.getByText(/local demo data/i).first().waitFor();
  check("landing shows demo-data disclosure", true);

  // 2. Protected routes redirect when signed out
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(/\/login\?next=%2Fadmin/);
  check("signed-out /admin redirects to login with next", true);

  // 3. Volunteer login, role redirect
  await login(page, "vol@demo.worfix.local", "Vol-demo-1");
  await page.waitForURL(`${BASE}/app`);
  check("volunteer lands on /app", true);
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(`${BASE}/app`);
  check("volunteer cannot enter /admin (redirected)", true);
  await page.goto(`${BASE}/org`);
  await page.waitForURL(`${BASE}/app`);
  check("volunteer cannot enter /org (redirected)", true);

  // 4. Join the riverbank mission
  await page.goto(`${BASE}/missions`);
  await page.getByRole("link", { name: /Riverbank clean-up/ }).click();
  await page.getByRole("button", { name: "Join this mission" }).click();
  await page.waitForURL(/\/app\/missions\//);
  await page.getByRole("heading", { name: /Riverbank clean-up/ }).waitFor();
  check("joining a mission opens participation page", true);
  const missionUrl = page.url();

  // 5. Submit without photo -> validation
  await page.getByRole("button", { name: "Submit for review" }).click();
  check("submit without photo is blocked with a message", await page.getByText("Add at least one photo as evidence.").first().isVisible());

  // 6. Submit with photo + GPS consent but no capture
  await page.locator('input[type=file][aria-labelledby="photos-l"]').setInputFiles([`${__dirname}/photo1.jpg`]);
  await page.getByAltText(/Selected photo photo1.jpg/).waitFor();
  await page.getByLabel("Notes (optional)").fill("Collected 8 bags along the river.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByText("Pending review").first().waitFor();
  check("submission recorded as Pending review", true);
  check("volunteer sees NO fraud/risk info", (await page.getByText(/risk|Automatic checks/i).count()) === 0);
  await page.screenshot({ path: `${S}/shot-volunteer-submission.png`, fullPage: true });

  // 7. Org reviews: check flags, approve
  await logout(page);
  await login(page, "org@demo.worfix.local", "Org-demo-1");
  await page.waitForURL(`${BASE}/org`);
  await page.goto(`${BASE}/org/review`);
  await page.getByText("Automatic checks (advisory)").first().waitFor();
  check("org reviewer sees advisory flags", await page.getByText(/Submitted before the mission start time/).first().isVisible());
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Approve and reward" }).click();
  await page.getByText("Nothing to review here").waitFor();
  check("approval clears the pending queue", true);

  // 8. Volunteer: XP, points, certificate
  await logout(page);
  await login(page, "vol@demo.worfix.local", "Vol-demo-1");
  await page.waitForURL(`${BASE}/app`);
  await page.getByText("90 XP").first().waitFor();
  check("volunteer received 90 XP (easy, 2h)", true);
  check("impact breakdown shows 8 kg of litter collected", await page.getByText("8 kg of litter collected").isVisible());
  await page.goto(`${BASE}/app/certificates`);
  await page.getByRole("button", { name: "View certificate" }).click();
  const code = (await page.locator(".print-area .font-mono").innerText()).trim();
  check("certificate has WFX code", /^WFX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), code);
  check("certificate renders QR image", await page.locator('.print-area img[alt^="QR code"]').isVisible());
  await page.screenshot({ path: `${S}/shot-certificate.png` });
  await page.keyboard.press("Escape");

  // 9. Public verification (signed out)
  await logout(page);
  await page.goto(`${BASE}/verify/${code}`);
  await page.getByRole("heading", { name: "Valid certificate" }).waitFor();
  check("public verify page confirms the certificate", true);
  check("verify page does not expose user id/email", (await page.content()).includes("vol@demo") === false);
  await page.goto(`${BASE}/verify/WFX-AAAA-BBBB-CCCC`);
  await page.getByRole("heading", { name: "No certificate found" }).waitFor();
  check("unknown code shows 'No certificate found'", true);

  // 10. Double approval is impossible from UI: queue empty; also reward can't be duplicated by re-join/resubmit
  await login(page, "vol@demo.worfix.local", "Vol-demo-1");
  await page.waitForURL(`${BASE}/app`);
  await page.goto(missionUrl);
  check("approved mission shows no submit form", (await page.getByRole("button", { name: "Submit for review" }).count()) === 0);

  // 11. New user: registration -> unverified cannot join -> verify -> onboarding
  await logout(page);
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full name").fill("Test Person");
  await page.getByLabel("Email").fill("test.person@example.org");
  await page.getByLabel("Password", { exact: true }).fill("abcdef12");
  await page.getByLabel("Year of birth").fill("2013");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText(/aged 15 and over/).first().waitFor();
  check("under-15 is rejected at registration", true);
  await page.getByLabel("Year of birth").fill("2009");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Under 18: confirm a parent or guardian knows you are joining.").waitFor();
  check("15–17 requires guardian confirmation (error shown, boxes unticked)", true);
  await page.getByLabel(/A parent or guardian knows/).check();
  await page.getByLabel(/I am 15 or older/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app\/onboarding/);
  check("new volunteer is sent to onboarding", true);
  await page.getByLabel("Username").fill("test_person");
  await page.getByLabel("Country").fill("Uzbekistan");
  await page.getByLabel("City").fill("Samarkand");
  await page.getByLabel("Languages").fill("Uzbek, English");
  await page.getByText("environment", { exact: false }).first().click();
  await page.getByRole("button", { name: /Finish and explore/ }).click();
  await page.waitForURL(`${BASE}/app`);
  check("onboarding completes", true);
  await page.goto(`${BASE}/missions`);
  await page.getByRole("link", { name: /Plant saplings/ }).click();
  await page.getByRole("button", { name: "Join this mission" }).click();
  check("unverified email cannot join", await page.getByText(/Verify your email before joining/i).first().isVisible().catch(() => false));

  // 12. Admin: suspend flow + audit
  await logout(page);
  await login(page, "admin@demo.worfix.local", "Admin-demo-1");
  await page.waitForURL(`${BASE}/admin`);
  await page.goto(`${BASE}/admin/users`);
  await page.getByRole("row", { name: /Test Person/ }).getByRole("button", { name: "Suspend" }).click();
  await page.getByRole("button", { name: "Suspend account" }).click();
  check("suspension requires a reason", await page.getByText(/Give a reason/).isVisible());
  await page.getByLabel("Reason").fill("Testing suspension flow");
  await page.getByRole("button", { name: "Suspend account" }).click();
  await page.getByRole("row", { name: /Test Person/ }).getByText("suspended").waitFor();
  await page.goto(`${BASE}/admin/audit`);
  await page.getByText("user.suspend").first().waitFor();
  check("audit log records the suspension and the approval", (await page.getByText("user.suspend").count()) > 0 && (await page.getByText("submission.approved").count()) > 0);
  await logout(page);
  await login(page, "test.person@example.org", "abcdef12");
  await page.getByText(/account is suspended/i).first().waitFor({ timeout: 8000 });
  check("suspended user cannot log in", true);

  // 13. Responsive: no horizontal overflow at 320px
  const m = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const mp = await m.newPage();
  for (const path of ["/", "/missions", "/impact", "/login", "/register", "/about"]) {
    await mp.goto(BASE + path);
    await mp.waitForTimeout(500);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    check(`no horizontal overflow @320px ${path}`, !over);
  }
  await mp.goto(BASE);
  await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${S}/shot-mobile-home.png` });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}/shot-desktop-home.png` });

  check("no page errors / console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("E2E CRASH:", e.message.split("\n").slice(0, 6).join("\n")); process.exit(2); });
