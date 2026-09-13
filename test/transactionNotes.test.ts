import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../server/db";
import { renderTitlePortalPage } from "../server/transactionPages";

describe("Two-Way Title and Escrow Notes and Legal Safeguards", () => {
  const TEST_ORG_A = 8801;
  const TEST_ORG_B = 8802;
  const TEST_TOKEN_A = "test_token_tx_notes_aaa123";
  let txAId: number;
  let txBId: number;

  beforeAll(() => {
    db.query("DELETE FROM transaction_notes WHERE org_id IN (?, ?)").run(TEST_ORG_A, TEST_ORG_B);
    db.query("DELETE FROM transactions WHERE token_hash IN (?, ?)").run(TEST_TOKEN_A, "test_token_tx_notes_bbb456");
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(TEST_ORG_A, "Acquisitions Alpha LLC");
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(TEST_ORG_B, "Beta Capital Partners");

    const resA = db.query(`
      INSERT INTO transactions (
        org_id, contract_type, property_address, seller_name, seller_email,
        buyer_name, purchase_price, earnest_money, emd_status, closing_date,
        title_company_name, escrow_officer_name, escrow_officer_email,
        escrow_file_number, title_status, token_hash, status
      ) VALUES (
        ?, 'psa', '500 Title Way, Orlando, FL 32801', 'David Smith', 'david@example.com',
        'Acquisitions Alpha LLC', 320000, 5000, 'deposited', '2026-10-15',
        'First American Title', 'Rachel Green', 'rgreen@firstamtitle.example',
        'FAT-ORL-2026-110', 'opened', ?, 'sent'
      )
    `).run(TEST_ORG_A, TEST_TOKEN_A);
    txAId = Number(resA.lastInsertRowid);

    const resB = db.query(`
      INSERT INTO transactions (
        org_id, contract_type, property_address, seller_name, seller_email,
        buyer_name, purchase_price, earnest_money, emd_status, closing_date,
        title_company_name, escrow_officer_name, escrow_officer_email,
        escrow_file_number, title_status, token_hash, status
      ) VALUES (
        ?, 'psa', '900 Private Road, Miami, FL 33101', 'Alice Johnson', 'alice@example.com',
        'Beta Capital Partners', 450000, 10000, 'pending', '2026-11-01',
        'Chicago Title', 'Mark Sloan', 'msloan@chicagotitle.example',
        'CHI-MIA-9921', 'opened', 'test_token_tx_notes_bbb456', 'sent'
      )
    `).run(TEST_ORG_B);
    txBId = Number(resB.lastInsertRowid);
  });

  beforeEach(() => {
    db.query("DELETE FROM transaction_notes WHERE org_id IN (?, ?)").run(TEST_ORG_A, TEST_ORG_B);
  });

  test("allows subscriber to post notes to the escrow file", () => {
    const ins = db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, author_email, message, ip_address)
      VALUES (?, ?, 'subscriber', 'John Investor', 'john@alpha.example', 'EMD wire initiated from Chase bank account.', '192.168.1.5')
    `).run(txAId, TEST_ORG_A);

    expect(ins.changes).toBe(1);

    const notes = db.query("SELECT * FROM transaction_notes WHERE transaction_id = ?").all(txAId) as any[];
    expect(notes.length).toBe(1);
    expect(notes[0].author_role).toBe("subscriber");
    expect(notes[0].author_name).toBe("John Investor");
    expect(notes[0].message).toContain("EMD wire initiated");
  });

  test("allows title officer to post updates back to the subscriber", () => {
    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, author_email, message, ip_address)
      VALUES (?, ?, 'title_officer', 'Rachel Green (Escrow Officer)', 'rgreen@firstamtitle.example', 'Wiring instructions verified. EMD wire received and deposited in escrow trust account.', '12.34.56.78')
    `).run(txAId, TEST_ORG_A);

    const notes = db.query("SELECT * FROM transaction_notes WHERE transaction_id = ? ORDER BY id ASC").all(txAId) as any[];
    expect(notes.length).toBe(1);
    expect(notes[0].author_role).toBe("title_officer");
    expect(notes[0].author_name).toContain("Rachel Green");
    expect(notes[0].message).toContain("EMD wire received");
  });

  test("supports two-way chronological conversation feed", () => {
    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'title_officer', 'Rachel Green', 'Prelim title report completed. Clear on liens except Chase first mortgage.')
    `).run(txAId, TEST_ORG_A);

    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'subscriber', 'John Investor', 'Copy that, seller provided payoff authorization form attached to file.')
    `).run(txAId, TEST_ORG_A);

    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'title_officer', 'Rachel Green', 'Received payoff auth. Ordering payoff statement from Chase today.')
    `).run(txAId, TEST_ORG_A);

    const notes = db.query("SELECT * FROM transaction_notes WHERE transaction_id = ? ORDER BY id ASC").all(txAId) as any[];
    expect(notes.length).toBe(3);
    expect(notes[0].author_role).toBe("title_officer");
    expect(notes[1].author_role).toBe("subscriber");
    expect(notes[2].author_role).toBe("title_officer");
    expect(notes[2].message).toContain("Ordering payoff statement");
  });

  test("enforces strict tenant isolation for transaction notes", () => {
    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'subscriber', 'Org A User', 'Private note for deal A')
    `).run(txAId, TEST_ORG_A);

    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'subscriber', 'Org B User', 'Confidential note for deal B')
    `).run(txBId, TEST_ORG_B);

    const notesA = db.query("SELECT * FROM transaction_notes WHERE org_id = ?").all(TEST_ORG_A) as any[];
    expect(notesA.length).toBe(1);
    expect(notesA[0].message).toBe("Private note for deal A");

    const notesB = db.query("SELECT * FROM transaction_notes WHERE org_id = ?").all(TEST_ORG_B) as any[];
    expect(notesB.length).toBe(1);
    expect(notesB[0].message).toBe("Confidential note for deal B");
  });

  test("renderTitlePortalPage includes mandatory Wire Fraud Security Notice and Notes Stream", async () => {
    db.query(`
      INSERT INTO transaction_notes (transaction_id, org_id, author_role, author_name, message)
      VALUES (?, ?, 'title_officer', 'Rachel Green', 'Title opened, preliminary commitment in review.')
    `).run(txAId, TEST_ORG_A);

    const res = renderTitlePortalPage(TEST_TOKEN_A);
    expect(res.status).toBe(200);

    const html = await res.text();

    expect(html).toContain("Security &amp; Wire Fraud Warning");
    expect(html).toContain("NEVER");
    expect(html).toContain("verbally confirm wire details");

    expect(html).toContain("Two-Way Escrow Notes &amp; Activity Stream");
    expect(html).toContain("Title opened, preliminary commitment in review.");
    expect(html).toContain("Post Note to Escrow File");

    expect(html).toContain("Do not transmit Social Security Numbers");
    expect(html).toContain("Notes do not alter binding contract terms");
  });
});
