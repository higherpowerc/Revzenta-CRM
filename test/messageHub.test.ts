import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../server/db";

describe("Message Hub & Internal CRM Communications Suite", () => {
  const TEST_ORG_A = 9921;
  const TEST_ORG_B = 9922;
  const TEST_USER_A = 99211;
  const TEST_USER_B = 99221;

  beforeAll(() => {
    db.query("DELETE FROM internal_messages WHERE org_id IN (?, ?)").run(TEST_ORG_A, TEST_ORG_B);
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(TEST_ORG_A, "Apex Wholesale Group");
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(TEST_ORG_B, "Summit Equity Partners");
  });

  beforeEach(() => {
    db.query("DELETE FROM internal_messages WHERE org_id IN (?, ?)").run(TEST_ORG_A, TEST_ORG_B);
  });

  test("creates internal team messages across channels (general, acquisitions, underwriting, escrow)", () => {
    const channels = ["general", "acquisitions", "underwriting", "escrow"];

    for (const ch of channels) {
      const ins = db.query(`
        INSERT INTO internal_messages (
          org_id, channel, sender_name, sender_role, message_type, subject, body, direction, status
        ) VALUES (?, ?, 'Alex Miller', 'Acquisitions Lead', 'chat', ?, ?, 'internal', 'read')
      `).run(TEST_ORG_A, ch, `Update in #${ch}`, `Discussion content for team channel #${ch}`);

      expect(ins.changes).toBe(1);
    }

    const rows = db.query("SELECT * FROM internal_messages WHERE org_id = ?").all(TEST_ORG_A) as any[];
    expect(rows.length).toBe(4);
    expect(rows.map((r) => r.channel).sort()).toEqual(channels.sort());
  });

  test("handles two-way SMS messaging with direction and phone numbers", () => {
    // Outbound text to seller
    db.query(`
      INSERT INTO internal_messages (
        org_id, channel, sender_name, sender_role, recipient_name, message_type,
        body, direction, status, contact_phone, property_address
      ) VALUES (?, 'acquisitions', 'Alex Miller', 'Acquisitions Lead', 'John Seller', 'sms',
        'Hello John, we have approved your cash offer of $210,000 for 123 Main St.', 'outbound', 'delivered', '(555) 123-4567', '123 Main St')
    `).run(TEST_ORG_A);

    // Inbound reply from seller
    db.query(`
      INSERT INTO internal_messages (
        org_id, channel, sender_name, sender_role, recipient_name, message_type,
        body, direction, status, contact_phone, property_address
      ) VALUES (?, 'acquisitions', 'John Seller', 'Homeowner / Seller', 'Alex Miller', 'sms',
        'Thank you Alex! When can we sign the agreement?', 'inbound', 'unread', '(555) 123-4567', '123 Main St')
    `).run(TEST_ORG_A);

    const smsMessages = db.query("SELECT * FROM internal_messages WHERE org_id = ? AND message_type = 'sms' ORDER BY id ASC").all(TEST_ORG_A) as any[];
    expect(smsMessages.length).toBe(2);
    expect(smsMessages[0].direction).toBe("outbound");
    expect(smsMessages[0].status).toBe("delivered");
    expect(smsMessages[1].direction).toBe("inbound");
    expect(smsMessages[1].status).toBe("unread");
    expect(smsMessages[1].property_address).toBe("123 Main St");
  });

  test("supports pinning messages and toggle read status", () => {
    const ins = db.query(`
      INSERT INTO internal_messages (
        org_id, channel, sender_name, sender_role, message_type, subject, body, direction, status, is_pinned
      ) VALUES (?, 'general', 'Dave Vance', 'Lead Underwriter', 'chat', 'Important Policy', 'All offers above $250k require secondary underwriting approval.', 'internal', 'unread', 1)
    `).run(TEST_ORG_A);

    const id = Number(ins.lastInsertRowid);
    let msg = db.query("SELECT * FROM internal_messages WHERE id = ?").get(id) as any;
    expect(msg.is_pinned).toBe(1);
    expect(msg.status).toBe("unread");

    // Mark read and unpin
    db.query("UPDATE internal_messages SET is_pinned = 0, status = 'read', updated_at = datetime('now') WHERE id = ?").run(id);
    msg = db.query("SELECT * FROM internal_messages WHERE id = ?").get(id) as any;
    expect(msg.is_pinned).toBe(0);
    expect(msg.status).toBe("read");
  });

  test("guarantees multitenant isolation between different organizations", () => {
    db.query(`
      INSERT INTO internal_messages (org_id, channel, sender_name, message_type, body)
      VALUES (?, 'general', 'Org A Agent', 'chat', 'Confidential deal data for Org A only.')
    `).run(TEST_ORG_A);

    db.query(`
      INSERT INTO internal_messages (org_id, channel, sender_name, message_type, body)
      VALUES (?, 'general', 'Org B Agent', 'chat', 'Confidential deal data for Org B only.')
    `).run(TEST_ORG_B);

    const rowsA = db.query("SELECT * FROM internal_messages WHERE org_id = ?").all(TEST_ORG_A) as any[];
    const rowsB = db.query("SELECT * FROM internal_messages WHERE org_id = ?").all(TEST_ORG_B) as any[];

    expect(rowsA.length).toBe(1);
    expect(rowsA[0].body).toContain("Org A only");
    expect(rowsB.length).toBe(1);
    expect(rowsB[0].body).toContain("Org B only");
  });

  test("isolates internal CRM team members and 1-on-1 direct messages between subscriber teammates", () => {
    // Seed users in Org A and Org B
    db.query("INSERT OR IGNORE INTO users (id, email, password_hash, org_id, role) VALUES (?, ?, 'pw', ?, ?)").run(
      TEST_USER_A, "lead@apexwholesale.com", TEST_ORG_A, "admin"
    );
    const TEST_USER_A2 = TEST_USER_A + 1;
    db.query("INSERT OR IGNORE INTO users (id, email, password_hash, org_id, role) VALUES (?, ?, 'pw', ?, ?)").run(
      TEST_USER_A2, "closer@apexwholesale.com", TEST_ORG_A, "member"
    );

    db.query("INSERT OR IGNORE INTO users (id, email, password_hash, org_id, role) VALUES (?, ?, 'pw', ?, ?)").run(
      TEST_USER_B, "principal@summitequity.com", TEST_ORG_B, "admin"
    );

    // Verify team members query strictly scopes to org
    const orgAMembers = db.query("SELECT id, email FROM users WHERE org_id = ? ORDER BY id ASC").all(TEST_ORG_A) as any[];
    const orgBMembers = db.query("SELECT id, email FROM users WHERE org_id = ? ORDER BY id ASC").all(TEST_ORG_B) as any[];

    expect(orgAMembers.length).toBeGreaterThanOrEqual(2);
    expect(orgAMembers.some((u) => u.email === "lead@apexwholesale.com")).toBe(true);
    expect(orgAMembers.some((u) => u.email === "closer@apexwholesale.com")).toBe(true);
    expect(orgAMembers.some((u) => u.email.includes("summitequity"))).toBe(false);

    expect(orgBMembers.length).toBeGreaterThanOrEqual(1);
    expect(orgBMembers.some((u) => u.email === "principal@summitequity.com")).toBe(true);
    expect(orgBMembers.some((u) => u.email.includes("apexwholesale"))).toBe(false);

    // Org A teammates exchange a 1-on-1 direct message
    const msg1 = db.query(`
      INSERT INTO internal_messages (
        org_id, channel, sender_id, sender_name, sender_role, recipient_id, recipient_name, message_type, body, direction
      ) VALUES (?, 'direct', ?, 'Lead Partner', 'admin', ?, 'Closer Partner', 'chat', 'Hey closer, let us review the contract for 888 Elm St privately.', 'internal')
    `).run(TEST_ORG_A, TEST_USER_A, TEST_USER_A2);

    const msg2 = db.query(`
      INSERT INTO internal_messages (
        org_id, channel, sender_id, sender_name, sender_role, recipient_id, recipient_name, message_type, body, direction
      ) VALUES (?, 'direct', ?, 'Closer Partner', 'member', ?, 'Lead Partner', 'chat', 'Looks solid! Inspection contingency clears tomorrow at 5pm.', 'internal')
    `).run(TEST_ORG_A, TEST_USER_A2, TEST_USER_A);

    // Query 1-on-1 thread for Org A
    const thread = db.query(`
      SELECT * FROM internal_messages
      WHERE org_id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
      ORDER BY id ASC
    `).all(TEST_ORG_A, TEST_USER_A, TEST_USER_A2, TEST_USER_A2, TEST_USER_A) as any[];

    expect(thread.length).toBe(2);
    expect(thread[0].body).toContain("888 Elm St");
    expect(thread[1].body).toContain("Inspection contingency");

    // Org B queries for messages - must see 0 of Org A's direct messages
    const orgBThread = db.query(`
      SELECT * FROM internal_messages WHERE org_id = ?
    `).all(TEST_ORG_B) as any[];
    expect(orgBThread.length).toBe(0);

    // Cross-tenant update and delete tamper test
    const idA = Number(msg1.lastInsertRowid);
    const tamperUpdate = db.query("UPDATE internal_messages SET body = 'Hacked' WHERE id = ? AND org_id = ?").run(idA, TEST_ORG_B);
    expect(tamperUpdate.changes).toBe(0);

    const checkMsg = db.query("SELECT * FROM internal_messages WHERE id = ?").get(idA) as any;
    expect(checkMsg.body).toContain("888 Elm St");

    const tamperDelete = db.query("DELETE FROM internal_messages WHERE id = ? AND org_id = ?").run(idA, TEST_ORG_B);
    expect(tamperDelete.changes).toBe(0);
  });

  test("filters communications by search query and message type", () => {
    db.query(`
      INSERT INTO internal_messages (org_id, channel, sender_name, message_type, body, property_address)
      VALUES (?, 'underwriting', 'Dave Vance', 'chat', 'Comp valuation completed for 777 Sunset Blvd.', '777 Sunset Blvd')
    `).run(TEST_ORG_A);

    db.query(`
      INSERT INTO internal_messages (org_id, channel, sender_name, message_type, body, property_address)
      VALUES (?, 'escrow', 'Sarah Jenkins', 'escrow_note', 'Earnest money received for 400 Oak Ave.', '400 Oak Ave')
    `).run(TEST_ORG_A);

    const sunsetSearch = db.query("SELECT * FROM internal_messages WHERE org_id = ? AND body LIKE '%Sunset%'").all(TEST_ORG_A) as any[];
    expect(sunsetSearch.length).toBe(1);
    expect(sunsetSearch[0].property_address).toBe("777 Sunset Blvd");

    const escrowType = db.query("SELECT * FROM internal_messages WHERE org_id = ? AND message_type = 'escrow_note'").all(TEST_ORG_A) as any[];
    expect(escrowType.length).toBe(1);
    expect(escrowType[0].property_address).toBe("400 Oak Ave");
  });
});
