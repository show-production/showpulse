#!/usr/bin/env bash
# Create 24 users via ShowPulse API
# Run AFTER importing show data. Requires admin token.
# Usage: TOKEN=your_admin_token bash setup-users.sh

BASE="http://localhost:8080/api"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sarah Chen","pin":"9901","role":"admin","departments":[]}'
echo " -> Sarah Chen (admin)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Marcus Webb","pin":"9902","role":"admin","departments":[]}'
echo " -> Marcus Webb (admin)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tom Alvarez","pin":"8801","role":"manager","departments":[]}'
echo " -> Tom Alvarez (manager)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rachel Kim","pin":"8802","role":"manager","departments":[]}'
echo " -> Rachel Kim (manager)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"James O'Brien","pin":"8803","role":"manager","departments":[]}'
echo " -> James O'Brien (manager)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nina Patel","pin":"7701","role":"operator","departments":[]}'
echo " -> Nina Patel (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chris Tanaka","pin":"7702","role":"operator","departments":[]}'
echo " -> Chris Tanaka (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Rivera","pin":"7703","role":"operator","departments":[]}'
echo " -> Alex Rivera (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sam Okafor","pin":"7704","role":"operator","departments":[]}'
echo " -> Sam Okafor (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jordan Blake","pin":"7705","role":"operator","departments":[]}'
echo " -> Jordan Blake (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mia Fernandez","pin":"7706","role":"operator","departments":[]}'
echo " -> Mia Fernandez (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tyler Brooks","pin":"7707","role":"operator","departments":[]}'
echo " -> Tyler Brooks (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dana Morrison","pin":"7708","role":"operator","departments":[]}'
echo " -> Dana Morrison (operator)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Leo Chang","pin":"6601","role":"crew_lead","departments":["2872eadc-1de3-418b-bec6-8e4bdf48c6a1"]}'
echo " -> Leo Chang (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Emma Schmidt","pin":"6602","role":"crew_lead","departments":["135f3a56-0e49-4352-ba72-50515154b0f5"]}'
echo " -> Emma Schmidt (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Omar Hassan","pin":"6603","role":"crew_lead","departments":["bdcb31a6-8ed1-4e81-ab2c-7c26341a706e"]}'
echo " -> Omar Hassan (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","pin":"6604","role":"crew_lead","departments":["92196e4a-c277-4a38-93ee-2297660455b0", "472bc9c7-9edb-487c-aebf-7ae03952584c"]}'
echo " -> Priya Sharma (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jake Novak","pin":"6605","role":"crew_lead","departments":["b08329df-e484-48e9-90eb-5c256c61e294"]}'
echo " -> Jake Novak (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chloe Martin","pin":"6606","role":"crew_lead","departments":["a2242eb1-60cd-4b52-8fd3-9a823f5748dc", "acdb54d5-7eac-4f39-9514-6ed613b1e468"]}'
echo " -> Chloe Martin (crew_lead)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ben Torres","pin":"5501","role":"viewer","departments":["db78a549-6169-469b-8886-b0445b59b490", "fef13e41-75e5-482e-bf3a-f65a579bb3cf"]}'
echo " -> Ben Torres (viewer)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Zoe Williams","pin":"5502","role":"viewer","departments":["3f0aa37a-bd7b-4c94-9bc3-8a862b32799a"]}'
echo " -> Zoe Williams (viewer)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Kai Nguyen","pin":"5503","role":"viewer","departments":["86723e86-facd-463b-bf36-2cbb68cc00c7", "135f3a56-0e49-4352-ba72-50515154b0f5"]}'
echo " -> Kai Nguyen (viewer)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lily Foster","pin":"5504","role":"viewer","departments":["2872eadc-1de3-418b-bec6-8e4bdf48c6a1", "acdb54d5-7eac-4f39-9514-6ed613b1e468"]}'
echo " -> Lily Foster (viewer)"

curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ryan Cooper","pin":"5505","role":"viewer","departments":["bdcb31a6-8ed1-4e81-ab2c-7c26341a706e", "472bc9c7-9edb-487c-aebf-7ae03952584c"]}'
echo " -> Ryan Cooper (viewer)"

