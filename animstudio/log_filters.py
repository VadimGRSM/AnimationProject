import logging
import re


DISALLOWED_HOST_PATTERN = re.compile(r"Invalid HTTP_HOST header: '([^']+)'")


class IgnoreScannerDisallowedHostFilter(logging.Filter):
    RESERVED_NOISE_HOSTS = {
        'example.com',
        'www.example.com',
    }

    def filter(self, record):
        message = record.getMessage()
        match = DISALLOWED_HOST_PATTERN.search(message)
        if not match:
            return True

        host = match.group(1).strip().lower().rstrip('.')
        if ':' in host:
            host = host.split(':', 1)[0]
        if host.endswith('.example.com'):
            return False
        return host not in self.RESERVED_NOISE_HOSTS
