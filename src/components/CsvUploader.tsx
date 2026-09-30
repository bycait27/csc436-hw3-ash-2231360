import { useState, type ChangeEvent } from 'react'
import { parseCsv, type ParsedCsv } from '../lib/parseCsv'
import './CsvUploader.css'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_RECORDS = 10_000
const REQUIRED_HEADERS = [
  'ticket_id',
  'zone',
  'category',
  'priority',
  'opened_on',
  'closed_on',
  'estimated_hours',
  'summary',
]

const INVALID_HEADER_MESSAGE =
  'The first record must contain exactly these headers, once each: ticket_id, zone, category, priority, opened_on, closed_on, estimated_hours, summary. Your previous analysis is unchanged.'

export interface DatasetLoadResult {
  acceptedCount: number
  rejectedCount: number
}

interface CsvUploaderProps {
  onDatasetLoaded: (
    dataset: ParsedCsv & { fileName: string },
  ) => DatasetLoadResult | Promise<DatasetLoadResult>
}

interface ActiveDataset extends DatasetLoadResult {
  fileName: string
}

interface UploadError {
  fileName: string
  message: string
  invalidHeader: boolean
}

class InvalidCsvHeaderError extends Error {}

export function CsvUploader({ onDatasetLoaded }: CsvUploaderProps) {
  const [selectedFileName, setSelectedFileName] = useState('')
  const [activeDataset, setActiveDataset] = useState<ActiveDataset | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''

    if (!file) return

    setSelectedFileName(file.name)
    setError(null)
    setIsLoading(true)

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('Choose a CSV file that is no larger than 5 MiB.')
      }

      let contents: string
      try {
        contents = new TextDecoder('utf-8', { fatal: true }).decode(
          await file.arrayBuffer(),
        )
      } catch {
        throw new Error('The file could not be read as valid UTF-8.')
      }
      const parsed = parseCsv(contents)

      if (
        parsed.headers.length !== REQUIRED_HEADERS.length ||
        new Set(parsed.headers).size !== REQUIRED_HEADERS.length ||
        REQUIRED_HEADERS.some((header) => !parsed.headers.includes(header))
      ) {
        throw new InvalidCsvHeaderError(INVALID_HEADER_MESSAGE)
      }

      if (parsed.rows.length > MAX_RECORDS) {
        throw new Error('Choose a CSV file with no more than 10,000 records.')
      }

      const result = await onDatasetLoaded({ ...parsed, fileName: file.name })
      const { acceptedCount, rejectedCount } = result

      if (
        !Number.isInteger(acceptedCount) ||
        !Number.isInteger(rejectedCount) ||
        acceptedCount < 0 ||
        rejectedCount < 0 ||
        acceptedCount + rejectedCount !== parsed.rows.length
      ) {
        throw new Error('The dataset validator returned invalid record counts.')
      }

      setActiveDataset({ fileName: file.name, acceptedCount, rejectedCount })
    } catch (caughtError) {
      setError({
        fileName: file.name,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'The file could not be loaded.',
        invalidHeader: caughtError instanceof InvalidCsvHeaderError,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="csv-uploader" aria-labelledby="csv-uploader-title">
      <div className="csv-uploader__details">
        <div>
          <h2 id="csv-uploader-title">Load a local dataset</h2>
          <p className="csv-uploader__description">
            Use a supplied CSV. Records are read in this tab, never uploaded.
          </p>
        </div>

        {error ? (
          <div
            className="csv-uploader__error"
            role="alert"
            aria-live="assertive"
          >
            <strong>
              Could not load {error.fileName}
            </strong>
            <span>
              {error.invalidHeader
                ? INVALID_HEADER_MESSAGE
                : error.message}
            </span>
          </div>
        ) : (
          <p className="csv-uploader__status" aria-live="polite">
            {isLoading
              ? `Loading ${selectedFileName}…`
              : activeDataset
                ? `Loaded ${activeDataset.fileName}: ${activeDataset.acceptedCount} accepted, ${activeDataset.rejectedCount} rejected.`
                : 'Ready for a file. Start with verification.csv or campus-tickets.csv.'}
          </p>
        )}
      </div>

      <div className="csv-uploader__picker">
        <label className="csv-uploader__label" htmlFor="csv-file">
          Choose CSV file
        </label>
        <div className="csv-uploader__file-control">
          <input
            className="csv-uploader__input"
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            aria-describedby="csv-file-help csv-file-status"
            disabled={isLoading}
          />
          <label className="csv-uploader__button" htmlFor="csv-file">
            Choose File
          </label>
          <span className="csv-uploader__filename" id="csv-file-status" aria-live="polite">
            {selectedFileName || 'No file chosen'}
          </span>
        </div>
        <small id="csv-file-help">
          UTF-8 CSV, up to 5 MiB and 10,000 records.
        </small>
      </div>

      {activeDataset && (
        <div className="csv-uploader__active" aria-live="polite">
          <hr />
          <p>
            <strong>Active dataset:</strong> {activeDataset.fileName}
          </p>
          <p>
            <strong>{activeDataset.acceptedCount} accepted</strong> /{' '}
            <strong>{activeDataset.rejectedCount} rejected</strong>
          </p>
        </div>
      )}
    </section>
  )
}

export default CsvUploader
