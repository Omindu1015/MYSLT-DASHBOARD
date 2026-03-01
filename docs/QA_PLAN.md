# MySLT Dashboard: Quality Assurance (QA) Plan

This document defines the strategy for ensuring the reliability, security, and performance of the MySLT Dashboard.

## 1. Objectives
- Ensure all API endpoints are secure and functioning correctly.
- Validate that log data from remote servers is parsed and stored accurately.
- Guarantee a seamless and secure frontend experience.
- Maintain a vulnerability-free dependency tree.

## 2. Testing Levels

### 2.1 Unit Testing (Backend)
**Tool**: Jest
**Focus**:
- **Log Parsing**: Test `parseLogLine` with various inputs (valid, malformed, empty).
- **Middleware**: Verify `verifyToken` and `isAdmin` handle various JWT states correctly.
- **Utils**: Test database connection and SNMP setup logic.

### 2.2 Integration Testing
**Tool**: Jest + Supertest
**Focus**:
- **Authentication Flow**: Login -> Token Generation -> Access Protected Route.
- **Ingestion Pipeline**: Mock Fluent Bit request -> Validate DB entry -> Fetch from Dashboard API.
- **SNMP Monitoring**: Mock SNMP response -> Validate data aggregation.

### 2.3 Security Testing (Vulnerability Removal)
**Tools**: `npm audit`, `helmet`, `express-rate-limit`
**Focus**:
- **Automated Scanning**: Monthly `npm audit` and dependency updates.
- **Static Analysis**: ESLint for security-sensitive patterns (hardcoded keys).
- **Dynamic Analysis**: 
    - Verify security headers (HSTS, CSP, No-Sniff).
    - Validate Rate Limiting (prevent brute-force and DoS).
    - Cross-Site Scripting (XSS) prevention on the frontend.

### 2.4 Frontend QA
**Tool**: Manual + Vite testing (conceptually)
**Focus**:
- **Responsive Design**: Verify layout on mobile, tablet, and desktop.
- **Data Display**: Ensure Recharts components correctly visualize backend data.
- **Auth State**: Verify session persistence and automatic logout on token expiry.

## 3. Vulnerability Removal Roadmap

| Vulnerability Type | Solution | Priority |
|-------------------|----------|----------|
| Dependency (ReDoS/DoS) | `npm audit fix` & core package upgrades | High |
| Hardcoded Secrets | Move to Environment Variables (.env) | Critical |
| Brute Force Access | Implement `express-rate-limit` | High |
| Missing Security Headers | Implement `helmet` | Medium |
| Input Injection | Enhance input validation in controllers | High |

## 4. Execution Schedule
1. **Infrastructure**: Set up Jest and configure test environments.
2. **Security Fixes**: Implement middleware and remove hardcoded secrets.
3. **Unit Tests**: Write and run tests for critical logic.
4. **Final Audit**: Run `npm audit` to ensure no remaining vulnerabilities.
