import 'react-international-phone/style.css'
import { PhoneInput as RIPInput } from 'react-international-phone'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
  inputClassName?: string
}

export default function PhoneInput({ value, onChange, required, inputClassName }: Props) {
  return (
    <RIPInput
      defaultCountry="ke"
      value={value}
      onChange={onChange}
      inputProps={{ required }}
      inputClassName={inputClassName}
      style={{ width: '100%' }}
    />
  )
}
