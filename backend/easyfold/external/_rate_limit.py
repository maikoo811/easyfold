from aiolimiter import AsyncLimiter

RCSB_LIMITER = AsyncLimiter(max_rate=10, time_period=1)
UNIPROT_LIMITER = AsyncLimiter(max_rate=10, time_period=1)
