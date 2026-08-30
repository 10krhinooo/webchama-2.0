import 'react-international-phone/style.css'
import { PhoneInput as RIPInput } from 'react-international-phone'

interface Props {
  /** Forwarded to the underlying tel input so a FormField label can point at something real. */
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  inputClassName?: string
}

export default function PhoneInput({ id, value, onChange, required, inputClassName }: Props) {
  return (
    <RIPInput
      defaultCountry="ke"
      value={value}
      onChange={onChange}
      inputProps={{ id, required }}
      inputClassName={inputClassName}
      style={{ width: '100%' }}
    />
  )
}
