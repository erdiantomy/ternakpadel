#!/usr/bin/env bash
# Point ternakpadel.xyz at GitHub Pages via the Namecheap API.
#
# WARNING: namecheap.domains.dns.setHosts REPLACES the domain's entire host
# record set. This script first prints the current records (getHosts) so you
# can abort if anything important would be lost. Re-add any custom records
# (e.g. email MX) to the setHosts call below before running.
#
# Requires:
#   NAMECHEAP_USER     Namecheap account username (ApiUser/UserName)
#   NAMECHEAP_API_KEY  API key from namecheap.com → Profile → Tools → API access
#   CLIENT_IP          this machine's public IP — must be whitelisted in the
#                      Namecheap API access settings
#
# Usage: NAMECHEAP_USER=you NAMECHEAP_API_KEY=xxx CLIENT_IP=1.2.3.4 scripts/namecheap-dns.sh
set -euo pipefail

: "${NAMECHEAP_USER:?set NAMECHEAP_USER}"
: "${NAMECHEAP_API_KEY:?set NAMECHEAP_API_KEY}"
: "${CLIENT_IP:?set CLIENT_IP (public IP whitelisted in Namecheap API settings)}"

API="https://api.namecheap.com/xml.response"
BASE="ApiUser=$NAMECHEAP_USER&ApiKey=$NAMECHEAP_API_KEY&UserName=$NAMECHEAP_USER&ClientIp=$CLIENT_IP&SLD=ternakpadel&TLD=xyz"

echo "==> Current host records (review before they are replaced):"
curl -fsS "$API?$BASE&Command=namecheap.domains.dns.getHosts"
echo
read -r -p "Replace ALL records with the GitHub Pages set? [y/N] " ok
[ "${ok,,}" = "y" ] || { echo "aborted"; exit 1; }

# GitHub Pages apex A records + www CNAME
echo "==> Setting records"
curl -fsS "$API?$BASE&Command=namecheap.domains.dns.setHosts\
&HostName1=@&RecordType1=A&Address1=185.199.108.153&TTL1=1800\
&HostName2=@&RecordType2=A&Address2=185.199.109.153&TTL2=1800\
&HostName3=@&RecordType3=A&Address3=185.199.110.153&TTL3=1800\
&HostName4=@&RecordType4=A&Address4=185.199.111.153&TTL4=1800\
&HostName5=www&RecordType5=CNAME&Address5=erdiantomy.github.io.&TTL5=1800"
echo
echo "Done — look for IsSuccess=\"true\" above. DNS propagates in minutes to ~1h."
