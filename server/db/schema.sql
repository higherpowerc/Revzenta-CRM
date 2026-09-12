-- ============================================================================
-- REVZENTA ENTERPRISE DATABASE SCHEMA (POSTGRESQL)
-- Production multi-tenant CRM + Nationwide Property Intelligence Architecture
-- ============================================================================

-- 1. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    stages JSONB NOT NULL DEFAULT '["Leads", "Onboarding", "Sold"]'::jsonb,
    accent_color VARCHAR(20) NOT NULL DEFAULT '#d6ff3f',
    dashboard_color VARCHAR(20) DEFAULT '',
    custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    service_model VARCHAR(50) DEFAULT 'both',
    delivery_type VARCHAR(50) DEFAULT 'both',
    industry VARCHAR(100) DEFAULT '',
    intake_opts JSONB DEFAULT '[]'::jsonb,
    custom_intake_groups JSONB DEFAULT '[]'::jsonb,
    vertical_key VARCHAR(100) DEFAULT '',
    monthly_subscription_amount NUMERIC(12, 2) DEFAULT 0,
    revenue_model VARCHAR(50) DEFAULT 'sales',
    billing_cycle_date VARCHAR(20) DEFAULT '',
    tier VARCHAR(50) DEFAULT 'pro',
    status VARCHAR(50) DEFAULT 'active',
    canceled_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    allow_self_schedule BOOLEAN DEFAULT false,
    agreement_template TEXT DEFAULT '',
    agreements_pin_hash VARCHAR(128) DEFAULT '',
    email_sender_name VARCHAR(255) DEFAULT '',
    email_reply_to VARCHAR(255) DEFAULT '',
    webhook_secret VARCHAR(128) DEFAULT '',
    rentcast_api_key VARCHAR(255) DEFAULT '',
    rentcast_monthly_limit INTEGER DEFAULT 50,
    rentcast_hard_stop_enabled BOOLEAN DEFAULT true,
    rentcast_usage_offset INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orgs_status ON organizations(status);

-- 2. USERS & RBAC
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin' | 'member'
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. NATIONWIDE PROPERTIES CATALOG
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    apn VARCHAR(100),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT DEFAULT '',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip VARCHAR(20) NOT NULL,
    county VARCHAR(100) DEFAULT '',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    property_type VARCHAR(50) DEFAULT 'Single Family',
    bedrooms NUMERIC(4, 1),
    bathrooms NUMERIC(4, 1),
    square_feet INTEGER,
    lot_size_sqft INTEGER,
    year_built INTEGER,
    stories NUMERIC(3, 1),
    garage_spaces INTEGER,
    construction_type VARCHAR(100),
    estimated_value NUMERIC(14, 2),
    value_range_low NUMERIC(14, 2),
    value_range_high NUMERIC(14, 2),
    estimated_equity NUMERIC(14, 2),
    equity_percent NUMERIC(5, 2),
    estimated_rent NUMERIC(10, 2),
    last_sale_price NUMERIC(14, 2),
    last_sale_date DATE,
    mortgage_balance NUMERIC(14, 2),
    loan_amount NUMERIC(14, 2),
    loan_date DATE,
    loan_interest_rate NUMERIC(5, 3),
    tax_assessed_value NUMERIC(14, 2),
    tax_annual_amount NUMERIC(12, 2),
    tax_delinquent BOOLEAN DEFAULT false,
    has_liens BOOLEAN DEFAULT false,
    is_foreclosure BOOLEAN DEFAULT false,
    is_pre_foreclosure BOOLEAN DEFAULT false,
    is_bankruptcy BOOLEAN DEFAULT false,
    is_probate BOOLEAN DEFAULT false,
    is_vacant BOOLEAN DEFAULT false,
    has_code_violations BOOLEAN DEFAULT false,
    is_absentee_owner BOOLEAN DEFAULT false,
    revzenta_opportunity_score INTEGER DEFAULT 0,
    opportunity_score_reasons JSONB DEFAULT '[]'::jsonb,
    source_provider VARCHAR(50) DEFAULT 'rentcast',
    source_record_id VARCHAR(100),
    confidence_score NUMERIC(4, 3) DEFAULT 1.0,
    data_retrieved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prop_org_id ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_prop_apn ON properties(organization_id, apn);
CREATE INDEX IF NOT EXISTS idx_prop_address ON properties(organization_id, address_line1);
CREATE INDEX IF NOT EXISTS idx_prop_zip ON properties(organization_id, zip);
CREATE INDEX IF NOT EXISTS idx_prop_county ON properties(organization_id, county);
CREATE INDEX IF NOT EXISTS idx_prop_state_city ON properties(organization_id, state, city);
CREATE INDEX IF NOT EXISTS idx_prop_value ON properties(organization_id, estimated_value);
CREATE INDEX IF NOT EXISTS idx_prop_equity ON properties(organization_id, estimated_equity);
CREATE INDEX IF NOT EXISTS idx_prop_score ON properties(organization_id, revzenta_opportunity_score DESC);

-- 4. PROPERTY OWNERS
CREATE TABLE IF NOT EXISTS property_owners (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    entity_name TEXT DEFAULT '',
    is_corporate_owner BOOLEAN DEFAULT false,
    mailing_address TEXT DEFAULT '',
    mailing_city VARCHAR(100) DEFAULT '',
    mailing_state VARCHAR(50) DEFAULT '',
    mailing_zip VARCHAR(20) DEFAULT '',
    occupancy_status VARCHAR(50) DEFAULT 'unknown',
    ownership_type VARCHAR(50) DEFAULT 'individual',
    purchase_date DATE,
    ownership_years NUMERIC(4, 1),
    phones JSONB DEFAULT '[]'::jsonb,
    emails JSONB DEFAULT '[]'::jsonb,
    source_provider VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_owners_org_id ON property_owners(organization_id);
CREATE INDEX IF NOT EXISTS idx_owners_property_id ON property_owners(property_id);
CREATE INDEX IF NOT EXISTS idx_owners_name ON property_owners(organization_id, full_name);

-- 5. SAVED SEARCHES (NATURAL LANGUAGE & STRUCTURED)
CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    natural_language_query TEXT DEFAULT '',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_refresh BOOLEAN DEFAULT false,
    alert_enabled BOOLEAN DEFAULT false,
    matching_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_org ON saved_searches(organization_id);

-- 6. CLIENTS / CRM LEADS
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL DEFAULT '',
    industry VARCHAR(100) NOT NULL DEFAULT '',
    services JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    deal_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
    stage VARCHAR(100) NOT NULL DEFAULT 'Prospect',
    next_action TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    archived BOOLEAN NOT NULL DEFAULT false,
    client_type VARCHAR(50) NOT NULL DEFAULT 'residential',
    address TEXT NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    state VARCHAR(50) NOT NULL DEFAULT '',
    zip VARCHAR(20) NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    lead_source VARCHAR(100) NOT NULL DEFAULT '',
    agent_name VARCHAR(100) DEFAULT '',
    agent_email VARCHAR(255) DEFAULT '',
    agent_phone VARCHAR(50) DEFAULT '',
    billing_address TEXT DEFAULT '',
    billing_city VARCHAR(100) DEFAULT '',
    billing_state VARCHAR(50) DEFAULT '',
    billing_zip VARCHAR(20) DEFAULT '',
    billing_same BOOLEAN DEFAULT false,
    preferred_contact_method VARCHAR(50) DEFAULT '',
    business_type VARCHAR(100) DEFAULT '',
    tax_id_ein VARCHAR(50) DEFAULT '',
    ap_contact TEXT DEFAULT '',
    po_required BOOLEAN DEFAULT false,
    units_locations TEXT DEFAULT '',
    property_manager_name TEXT DEFAULT '',
    property_manager_contact TEXT DEFAULT '',
    hoa_name TEXT DEFAULT '',
    hoa_contact TEXT DEFAULT '',
    access_instructions TEXT DEFAULT '',
    coi_required BOOLEAN DEFAULT false,
    service_contract TEXT DEFAULT '',
    dba_name TEXT DEFAULT '',
    ein_ssn VARCHAR(50) DEFAULT '',
    homeowner_renter VARCHAR(50) DEFAULT '',
    hoa_restrictions TEXT DEFAULT '',
    parking_access TEXT DEFAULT '',
    pet_on_premises BOOLEAN DEFAULT false,
    preferred_service_location TEXT DEFAULT '',
    lost BOOLEAN NOT NULL DEFAULT false,
    lost_reason TEXT NOT NULL DEFAULT '',
    dnc BOOLEAN NOT NULL DEFAULT false,
    dnc_reason TEXT NOT NULL DEFAULT '',
    dnc_date VARCHAR(20) NOT NULL DEFAULT '',
    provisioned_org_id INTEGER NOT NULL DEFAULT 0,
    monthly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    agreement_status VARCHAR(50) NOT NULL DEFAULT 'not_sent',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'none',
    payment_link_url TEXT NOT NULL DEFAULT '',
    paid_at TIMESTAMPTZ,
    payment_amount_cents INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id VARCHAR(100) NOT NULL DEFAULT '',
    stripe_price_id VARCHAR(100) NOT NULL DEFAULT '',
    stripe_link_id VARCHAR(100) NOT NULL DEFAULT '',
    demo_outcome VARCHAR(50) NOT NULL DEFAULT '',
    demo_scheduled_at VARCHAR(50) NOT NULL DEFAULT '',
    demo_meeting_link TEXT NOT NULL DEFAULT '',
    follow_up_note TEXT NOT NULL DEFAULT '',
    timezone VARCHAR(50) NOT NULL DEFAULT '',
    tier VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_org_stage ON clients(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_clients_org_updated ON clients(org_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_clients_org_lost ON clients(org_id, lost);

-- 7. TASKS
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    due_date VARCHAR(50) NOT NULL DEFAULT '',
    done BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_org_done ON tasks(org_id, done);
CREATE INDEX IF NOT EXISTS idx_tasks_org_client ON tasks(org_id, client_id);

-- 8. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    due_date VARCHAR(50) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);

-- 9. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    scheduled_at VARCHAR(50) NOT NULL DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    notes TEXT NOT NULL DEFAULT '',
    token VARCHAR(128) NOT NULL DEFAULT '',
    reminder_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_org_scheduled ON appointments(org_id, scheduled_at);

-- 10. OFFERS REPOSITORY
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    pdf_id VARCHAR(100) NOT NULL,
    property_address TEXT NOT NULL,
    seller_name TEXT NOT NULL DEFAULT '',
    seller_email VARCHAR(255) NOT NULL DEFAULT '',
    business_name TEXT NOT NULL DEFAULT '',
    offer_type VARCHAR(50) NOT NULL DEFAULT 'all',
    selected_offers JSONB NOT NULL DEFAULT '[]'::jsonb,
    cash_offer_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    subto_purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    subto_debt NUMERIC(14, 2) NOT NULL DEFAULT 0,
    subto_cash_to_seller NUMERIC(14, 2) NOT NULL DEFAULT 0,
    subto_monthly_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
    creative_purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    creative_down_payment NUMERIC(14, 2) NOT NULL DEFAULT 0,
    creative_monthly_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
    creative_interest_rate NUMERIC(5, 3) NOT NULL DEFAULT 0,
    creative_balloon_years NUMERIC(4, 1) NOT NULL DEFAULT 0,
    creative_total_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    closing_days INTEGER NOT NULL DEFAULT 14,
    email_status VARCHAR(50) NOT NULL DEFAULT 'sent',
    status VARCHAR(50) NOT NULL DEFAULT 'Sent',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offers_org ON offers(org_id);
CREATE INDEX IF NOT EXISTS idx_offers_client ON offers(client_id);

-- 11. WHOLESALE TRANSACTIONS & ESCROW HUB
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    contract_type VARCHAR(50) NOT NULL DEFAULT 'psa',
    property_address TEXT NOT NULL,
    seller_name TEXT NOT NULL DEFAULT '',
    seller_email VARCHAR(255) NOT NULL DEFAULT '',
    seller_phone VARCHAR(50) NOT NULL DEFAULT '',
    buyer_name TEXT NOT NULL DEFAULT '',
    buyer_email VARCHAR(255) NOT NULL DEFAULT '',
    buyer_phone VARCHAR(50) NOT NULL DEFAULT '',
    purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    assignment_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
    earnest_money NUMERIC(14, 2) NOT NULL DEFAULT 0,
    emd_due_date VARCHAR(50) NOT NULL DEFAULT '',
    emd_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    inspection_days INTEGER NOT NULL DEFAULT 10,
    inspection_deadline VARCHAR(50) NOT NULL DEFAULT '',
    inspection_status VARCHAR(50) NOT NULL DEFAULT 'active',
    closing_date VARCHAR(50) NOT NULL DEFAULT '',
    title_company_name TEXT NOT NULL DEFAULT '',
    escrow_officer_name TEXT NOT NULL DEFAULT '',
    escrow_officer_email VARCHAR(255) NOT NULL DEFAULT '',
    escrow_officer_phone VARCHAR(50) NOT NULL DEFAULT '',
    escrow_file_number VARCHAR(100) NOT NULL DEFAULT '',
    title_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payoff_lender TEXT NOT NULL DEFAULT '',
    payoff_demand_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    payoff_loan_number VARCHAR(100) NOT NULL DEFAULT '',
    state_jurisdiction VARCHAR(100) NOT NULL DEFAULT 'US General',
    contract_pdf_id VARCHAR(100) NOT NULL DEFAULT '',
    token_hash VARCHAR(128) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    signed_at TIMESTAMPTZ,
    signer_name TEXT NOT NULL DEFAULT '',
    signer_signature TEXT NOT NULL DEFAULT '',
    signer_ip VARCHAR(50) NOT NULL DEFAULT '',
    custom_terms TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_token_hash ON transactions(token_hash);

-- 12. CASH BUYERS
CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    criteria TEXT NOT NULL DEFAULT '',
    bought TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyers_org ON buyers(org_id);

-- 13. CACHE & USAGE
CREATE TABLE IF NOT EXISTS property_enrichment_cache (
    id SERIAL PRIMARY KEY,
    normalized_address TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'rentcast',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days')
);
CREATE INDEX IF NOT EXISTS idx_enrich_cache_addr ON property_enrichment_cache(normalized_address);

CREATE TABLE IF NOT EXISTS rentcast_api_usage_log (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    cached BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rentcast_usage_org ON rentcast_api_usage_log(org_id, created_at);

-- 14. COMPLIANCE & SUPPRESSION
CREATE TABLE IF NOT EXISTS privacy_suppression_registry (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    address TEXT DEFAULT '',
    owner_name TEXT DEFAULT '',
    purge_type VARCHAR(50) NOT NULL DEFAULT 'ccpa_delete',
    purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_privacy_suppression_org_phone ON privacy_suppression_registry(org_id, phone);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action ON audit_logs(organization_id, action, created_at);

-- 16. USAGE METERING
CREATE TABLE IF NOT EXISTS usage_meter (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    period_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_meter_org_period ON usage_meter(organization_id, period_month);

-- 17. PROPERTY DISTRESS ALERTS & MONITORING LOGS
CREATE TABLE IF NOT EXISTS property_distress_alerts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    saved_search_id INTEGER REFERENCES saved_searches(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    headline VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_distress_alerts_org ON property_distress_alerts(organization_id, is_read);
CREATE INDEX IF NOT EXISTS idx_distress_alerts_created ON property_distress_alerts(organization_id, created_at DESC);
