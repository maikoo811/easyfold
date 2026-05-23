class ExternalSourceError(Exception):
    """Base class for failures talking to an external sequence/structure source."""


class SequenceNotFound(ExternalSourceError):
    """The requested identifier does not exist at the source."""


class ExternalSourceUnavailable(ExternalSourceError):
    """Network failure, timeout, or persistent 5xx from the source."""


class MalformedExternalResponse(ExternalSourceError):
    """The source returned a 2xx response we couldn't parse into a FetchedSequence."""
