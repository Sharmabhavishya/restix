// Grants or removes a moderator/admin role. The person must have signed in once.
//
//   DATABASE_URL=... npm run admin:grant -- someone@snu.edu.in admin
//   DATABASE_URL=... npm run admin:grant -- someone@snu.edu.in moderator
//   DATABASE_URL=... npm run admin:grant -- someone@snu.edu.in none
//
// Runs with the database owner's privileges, so it is the bootstrap path for the first
// admin. Every change is written to the moderation audit log.
import postgres from "postgres";

async function main() {
  const [email, role] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url || !email || !["admin", "moderator", "none"].includes(role ?? "")) {
    console.error("usage: DATABASE_URL=... npm run admin:grant -- <email> <admin|moderator|none>");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [user] = await sql<{ id: string; display_name: string }[]>`
      select p.id, p.display_name from restix.profiles p join restix.profile_private pp on pp.user_id = p.id
      where lower(pp.email) = ${email.toLowerCase()}`;
    if (!user) {
      console.error(`No ResTix account for ${email}. They need to sign in once first.`);
      process.exit(1);
    }
    await sql.begin(async (tx) => {
      await tx`delete from restix.admin_roles where user_id = ${user.id}`;
      if (role !== "none") await tx`insert into restix.admin_roles (user_id, role) values (${user.id}, ${role})`;
      await tx`insert into restix.moderation_actions (actor_id, action, reason, user_id, metadata)
               values (null, ${role === "none" ? "revoke_role" : "grant_role"}, 'Changed from the command line (scripts/grant-role.ts)',
                       ${user.id}, ${tx.json({ to: role === "none" ? null : role })})`;
    });
    console.log(`${user.display_name} <${email}> is now: ${role}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
