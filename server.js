const { default: axios } = require('axios');
const express = require('express');
const cron = require('node-cron')
const cors = require('cors')
const {XMLParser} = require('fast-xml-parser')
const dotenv = require('dotenv')
const app = express();
const PORT = 9000;
app.use(cors());
const date = new Date();
const currentDate = date.getDate() - 4;
const currentMonth = date.getMonth() + 1;
const currentYear = date.getFullYear();
console.log("date:",currentDate , 'month:' , currentMonth , "year:" ,currentYear);


// storing biometric data in Database
const postBiometricAttendence = async () =>{
    // biometric backend port link
    const getBiometricData = await axios.get('http://localhost:9000/biometric/xmlapi');

    // Eportal backend port link
    const postBiometricData = await axios.post('https://g79l1s80-4000.inc1.devtunnels.ms/Employee/biometric/attendence',getBiometricData.data);
    console.log('jjkhkh',postBiometricData.config.data);
}

// it will store per day attendance data into mongoDB at given time
// cron.schedule('*/5 * * * * *',postBiometricAttendence);
  
app.get('/biometric/xmlapi',async (req,res)=>{
    const week = [
        'Sunday',
        'Monday',
        'Tuesday',
        "Wednesday",
        'Thursday',
        'Friday',
        'Saturday',
    ];

    let currentDate2 = `${currentYear}-${currentMonth}-${currentDate}`;
    let day = new Date(currentDate2).getDay();
 
    try{
        const xmlBody = 
        `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
           <GetTransactionsLog xmlns="http://tempuri.org/">
            <FromDateTime>${currentYear}-${currentMonth}-${currentDate} 9:00</FromDateTime>
              <ToDateTime>${currentYear}-${currentMonth}-${currentDate} 21:00</ToDateTime>
              <SerialNumber>EUF7241201111</SerialNumber>
              <UserName>API</UserName>
              <UserPassword>Api@1234</UserPassword>
              <strDataList></strDataList>
           </GetTransactionsLog>
          </soap:Body>
        </soap:Envelope>`;

        const URL = `http://localhost:88/iclock/webapiservice.asmx?op=GetTransactionsLog`;
        const headers = {
            'content-type':'text/xml',
        }
        const response = await axios.post(URL,xmlBody,{headers});
        const parser = response.data.split('strDataList>');
        
        // handle error if data is not available , example=> saturday and sunday
        if(parser[1] == undefined){
            const data = [{'esslId':'not available' , 'date':`${currentYear}-${currentMonth}-${currentDate}`, 'day':week[day] ,'time':'not available' , 'workingHour':'not available'}]
            return res.status(200).json(data);
        }

        const data = parser[1].split('\n');
        const jsonData = data.reduce((acc,value)=>{
            const arrData = value.split('\t')
            let len = arrData.length;
            if(len > 1){
                const day_time = arrData[1].split(' ');
                acc.push({'esslId':arrData[0] , 'date':day_time[0] , 'day':week[day] ,'time':day_time[1] , 'workingHour':''}) 
            }
            return acc;
        },[])
        jsonData.sort((a,b)=> Number(a.id) - Number(b.id));
        
        // calculate all day's workingHour  
        let totalWorkingHourSeconds = 0;
        let i = 0;
        let dataLen = jsonData.length;
        let pervID = jsonData[0]?.esslId
        while(i < dataLen){
            if(Number(jsonData[i]?.esslId) == Number(jsonData[i+1]?.esslId)){
             const [checkInHour , checkInMinutes , checkInSeconds]= jsonData[i].time.split(':').map(Number);
             const checkInTimeInSeconds = checkInHour*3600 + checkInMinutes*60 + checkInSeconds;
       
             const [checkOutHour , checkOutMinutes , checkOutSeconds]= jsonData[i+1].time.split(':').map(Number);
             const checkOutTimeInSeconds = checkOutHour*3600 + checkOutMinutes*60 + checkOutSeconds;
             
             const workingTime = checkOutTimeInSeconds - checkInTimeInSeconds;
             if(pervID != jsonData[i]?.esslId){
                pervID = jsonData[i]?.esslId;
                totalWorkingHourSeconds = 0;
             }
             totalWorkingHourSeconds += workingTime;
             
             // convert seconds into actual time
             const hrs = Math.floor(totalWorkingHourSeconds / 3600);
             const mins = Math.floor((totalWorkingHourSeconds % 3600) / 60);
             const secs = totalWorkingHourSeconds % 60;
             const actualTime = `${hrs.toString().padStart(2, '0')}.${mins.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}`; 
             
             // store actual time into object's workingHour field
             jsonData[i+1].workingHour = actualTime;
             i+=2;  
             
            //  console.log(jsonData[i].esslId,totalWorkingHourSeconds,checkOutTimeInSeconds,checkInTimeInSeconds);
            
          }else{
             totalWorkingHourSeconds = 0;
             i++;
          }
        }
        console.log('lenght' , jsonData);
        return res.status(200).json(jsonData);
    }catch(err){
        console.log('error during fetch XMLAPI',err);
        res.send("400");
    }
})

app.listen(PORT , ()=>{
    console.log('server connected at ',PORT);
})